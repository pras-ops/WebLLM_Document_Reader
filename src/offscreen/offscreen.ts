import { ExtensionMessage } from '../shared/types';
import { ParserRegistry } from './parsers';
import { RAGPipeline, VectorDB } from './rag';
import { LLMEngine, ChromePromptEngine, WebGPUEngine, WasmEngine, probeEngineCapabilities } from './engine';

class OffscreenApp {
  private port!: chrome.runtime.Port;
  private currentEngine: LLMEngine | null = null;
  private currentTier: 'builtin' | 'webgpu' | 'wasm' | null = null;
  private isInitializingModel = false;
  private idleTimer: any = null;

  constructor() {
    this.initializePortConnection();
    this.log('Offscreen coordinator loaded and ready.');
  }

  private log(msg: string): void {
    console.log('[Offscreen]', msg);
    const logsEl = document.getElementById('logs');
    if (logsEl) {
      const logDiv = document.createElement('div');
      logDiv.className = 'log';
      logDiv.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logsEl.appendChild(logDiv);
      while (logsEl.children.length > 50) {
        logsEl.removeChild(logsEl.firstChild!);
      }
    }
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = msg;
    }
  }

  private initializePortConnection(): void {
    // Connect to the background script
    this.port = chrome.runtime.connect({ name: 'offscreen' });
    
    this.port.onMessage.addListener((message: ExtensionMessage) => {
      this.handleMessage(message).catch((err) => {
        this.log(`Error handling message: ${err.message}`);
        this.port.postMessage({
          type: `${message.type}_REPLY`,
          error: err.message
        });
      });
    });
  }

  private async handleMessage(message: ExtensionMessage): Promise<void> {
    this.log(`Processing command: ${message.type}`);
    this.resetIdleTimer();

    switch (message.type) {
      case 'PROBE_CAPABILITIES': {
        const capabilities = await probeEngineCapabilities();
        this.port.postMessage({
          type: 'PROBE_CAPABILITIES_REPLY',
          payload: { capabilities }
        });
        break;
      }

      case 'INGEST_FILE': {
        const { filename, arrayBuffer } = message.payload;
        this.log(`Ingesting file: ${filename}`);
        
        // Step 1: Parse the file
        const parsedDoc = await ParserRegistry.parseFile(filename, arrayBuffer, (progressMsg) => {
          this.port.postMessage({
            type: 'INGEST_PROGRESS',
            payload: { message: progressMsg }
          });
        });

        // Step 2: Index with RAG
        const storedDoc = await RAGPipeline.ingestDocument(parsedDoc, (progressMsg) => {
          this.port.postMessage({
            type: 'INGEST_PROGRESS',
            payload: { message: progressMsg }
          });
        });

        this.port.postMessage({
          type: 'INGEST_COMPLETE',
          payload: {
            title: storedDoc.title,
            chunkCount: storedDoc.chunks.length,
            characterCount: storedDoc.text.length
          }
        });
        break;
      }

      case 'CHAT_MESSAGE': {
        const { documentTitle, message: query, engineTier } = message.payload;
        this.log(`Received query for document "${documentTitle}" using engine "${engineTier}"`);
        
        // Ensure engine is loaded and matches requested tier, falling back if needed
        await this.ensureEngineWithFallback(engineTier);

        // Retrieve top-k chunks
        this.log('Searching relevant document context...');
        const chunks = await RAGPipeline.retrieveRelevantChunks(documentTitle, query);
        
        if (chunks.length === 0) {
          this.port.postMessage({
            type: 'CHAT_REPLY',
            payload: {
              text: 'Could not find any relevant information in the document context.',
              citations: []
            }
          });
          return;
        }

        // Format system instructions + prompt
        const prompt = this.buildPrompt(query, chunks);
        this.log('Generating AI reply...');
        
        let accumulatedReply = '';
        await this.currentEngine!.generate(prompt, (chunkText) => {
          accumulatedReply += chunkText;
          // Stream tokens to side panel
          this.port.postMessage({
            type: 'CHAT_CHUNK',
            payload: { text: chunkText }
          });
        });

        // Map retrieved chunks to simplified citations
        const citations = chunks.map((c) => ({
          text: c.text,
          pageNumber: c.pageNumber,
          sheetName: c.sheetName
        }));

        this.port.postMessage({
          type: 'CHAT_REPLY',
          payload: {
            text: accumulatedReply,
            citations
          }
        });
        break;
      }

      case 'UNLOAD_ENGINE': {
        await this.unloadEngine();
        this.port.postMessage({
          type: 'UNLOAD_ENGINE_REPLY',
          payload: { success: true }
        });
        break;
      }

      case 'LIST_DOCUMENTS': {
        const docs = await VectorDB.listDocuments();
        this.port.postMessage({
          type: 'LIST_DOCUMENTS_REPLY',
          payload: { documents: docs }
        });
        break;
      }

      case 'DELETE_DOCUMENT': {
        const { title } = message.payload;
        await VectorDB.deleteDocument(title);
        this.port.postMessage({
          type: 'DELETE_DOCUMENT_REPLY',
          payload: { success: true }
        });
        break;
      }

      default:
        this.log(`Warning: Unknown command type: ${message.type}`);
    }

    this.startIdleTimer();
  }

  private async ensureEngine(tier: 'builtin' | 'webgpu' | 'wasm'): Promise<void> {
    if (this.currentEngine && this.currentTier === tier) {
      return;
    }

    if (this.isInitializingModel) {
      throw new Error('An engine is already initializing. Please wait.');
    }

    this.isInitializingModel = true;
    this.log(`Transitioning engine from "${this.currentTier}" to "${tier}"...`);

    try {
      if (this.currentEngine) {
        this.log('Unloading previous engine...');
        await this.currentEngine.unload();
        this.currentEngine = null;
        this.currentTier = null;
      }

      let engine: LLMEngine;
      switch (tier) {
        case 'builtin':
          engine = new ChromePromptEngine();
          break;
        case 'webgpu':
          engine = new WebGPUEngine();
          break;
        case 'wasm':
          engine = new WasmEngine();
          break;
        default:
          throw new Error(`Invalid engine tier requested: ${tier}`);
      }

      await engine.init((status, progress) => {
        this.port.postMessage({
          type: 'INIT_PROGRESS',
          payload: { status, progress }
        });
      });

      this.currentEngine = engine;
      this.currentTier = tier;
      this.log(`Engine tier "${tier}" successfully initialized and active.`);
    } catch (err) {
      this.log(`Failed to initialize engine tier "${tier}": ${(err as Error).message}`);
      throw err;
    } finally {
      this.isInitializingModel = false;
    }
  }

  private async ensureEngineWithFallback(requestedTier: 'builtin' | 'webgpu' | 'wasm'): Promise<void> {
    const tiersOrder: Array<'builtin' | 'webgpu' | 'wasm'> = ['builtin', 'webgpu', 'wasm'];
    const startIndex = tiersOrder.indexOf(requestedTier);
    
    let lastError: Error | null = null;
    
    for (let i = startIndex; i < tiersOrder.length; i++) {
      const tier = tiersOrder[i];
      try {
        await this.ensureEngine(tier);
        
        // If we fell back and successfully initialized a different engine tier, notify the sidepanel!
        if (tier !== requestedTier) {
          this.log(`Fallback triggered: fell back to "${tier}" because "${requestedTier}" failed.`);
          this.port.postMessage({
            type: 'ENGINE_FALLBACK',
            payload: { originalTier: requestedTier, activeTier: tier }
          });
        }
        return; // Success!
      } catch (err) {
        this.log(`Fallback check: engine tier "${tier}" failed to initialize: ${(err as Error).message}`);
        lastError = err as Error;
      }
    }
    
    throw lastError || new Error(`Failed to initialize engine and all fallbacks.`);
  }

  private async unloadEngine(): Promise<void> {
    if (this.currentEngine) {
      this.log(`Unloading engine tier "${this.currentTier}" due to idle time.`);
      await this.currentEngine.unload();
      this.currentEngine = null;
      this.currentTier = null;
    }
  }

  private buildPrompt(query: string, chunks: any[]): string {
    const contextText = chunks
      .map((c, i) => {
        let sourceTag = `[Source ${i + 1}]`;
        if (c.pageNumber) sourceTag += ` (Page ${c.pageNumber})`;
        if (c.sheetName) sourceTag += ` (Sheet ${c.sheetName})`;
        return `${sourceTag}:\n${c.text}`;
      })
      .join('\n\n---\n\n');

    return `You are a helpful local AI document reader assistant. Your task is to accurately and concisely answer the question using the provided context snippets from the document.
Cite the source numbers (e.g. [Source 1], [Source 2]) directly in your answers where they support your statements.
If the document content does not contain the answer, say so politely.

CONTEXT SNIPPETS FROM DOCUMENT:
${contextText}

USER QUESTION:
${query}

Please output your answer, including citations:`;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private startIdleTimer(): void {
    this.resetIdleTimer();
    // 5 minutes idle time limit
    this.idleTimer = setTimeout(() => {
      this.unloadEngine().catch(console.error);
    }, 5 * 60 * 1000);
  }
}

// Instantiate offscreen app
new OffscreenApp();
