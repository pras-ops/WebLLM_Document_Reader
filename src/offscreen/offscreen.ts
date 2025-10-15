import { CreateMLCEngine } from '@mlc-ai/web-llm';
import type { MLCEngineInterface, ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { ExtensionMessage, ChatMessage, ModelProgressMessage } from '../shared/types';

class OffscreenApp {
  private engine: MLCEngineInterface | null = null;
  private isInitializing = false;
  private statusElement: HTMLElement | null = null;
  private logsElement: HTMLElement | null = null;

  constructor() {
    this.statusElement = document.getElementById('status');
    this.logsElement = document.getElementById('logs');
    
    this.log('Offscreen document loaded');
    this.initializeMessageHandler();
  }

  private log(message: string): void {
    console.log('[Offscreen]', message);
    
    if (this.logsElement) {
      const logDiv = document.createElement('div');
      logDiv.className = 'log';
      logDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      this.logsElement.appendChild(logDiv);
      
      // Keep only last 50 logs
      while (this.logsElement.children.length > 50) {
        this.logsElement.removeChild(this.logsElement.firstChild!);
      }
    }
    
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }

  private initializeMessageHandler(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        this.handleMessage(message, sendResponse).catch((error) => {
          console.error('[Offscreen] Error handling message:', error);
          sendResponse({ error: (error as Error).message });
        });
        return true; // Keep message channel open
      }
    );
    
    this.log('Message handler initialized');
  }

  private async handleMessage(
    message: ExtensionMessage, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    this.log(`Received message: ${message.type}`);
    
    try {
      switch (message.type) {
        case 'CHAT_MESSAGE':
          await this.handleChatMessage(message as ChatMessage, sendResponse);
          break;
          
        case 'INIT_MODEL':
          await this.initializeEngine();
          sendResponse({ success: true });
          break;
          
        case 'INIT_OFFSCREEN':
          // Offscreen is already initialized, just acknowledge
          this.log('Offscreen already initialized');
          sendResponse({ success: true });
          break;
          
        default:
          this.log(`Unknown message type: ${message.type}`);
          sendResponse({ error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      this.log(`Error: ${(error as Error).message}`);
      sendResponse({ error: (error as Error).message });
    }
  }

  private async initializeEngine(): Promise<void> {
    if (this.engine) {
      this.log('Engine already initialized');
      return;
    }
    
    if (this.isInitializing) {
      this.log('Engine initialization already in progress');
      return;
    }

    this.isInitializing = true;
    this.log('Starting engine initialization...');
    
    try {
      // Use a smaller model for faster loading
      const model = 'Llama-3.2-3B-Instruct-q4f32_1-MLC';
      this.log(`Loading model: ${model}`);
      
      // Try WebGPU first, then fall back to WASM
      try {
        this.log('Attempting to initialize with WebGPU...');
        this.engine = await CreateMLCEngine(model, {
          initProgressCallback: (report) => {
            this.handleProgress(report);
          }
        });
        this.log('✓ Using WebGPU backend (fast)');
      } catch (webgpuError) {
        this.log(`WebGPU not available: ${(webgpuError as Error).message}`);
        this.log('Falling back to WASM backend (slower, but works on CPU)...');
        
        await this.sendProgress('WebGPU not available, using CPU fallback...', 0.1);
        
        // Try WASM backend as fallback
        this.engine = await CreateMLCEngine(model, {
          initProgressCallback: (report) => {
            this.handleProgress(report);
          },
          // Force WASM backend by not requesting WebGPU
          // @ts-ignore - WebLLM will automatically use WASM if WebGPU fails
          useWebGPU: false
        });
        this.log('✓ Using WASM backend (CPU-based, slower but compatible)');
      }

      await this.sendProgress('Model loaded successfully!', 1.0);
      this.log('✓ WebLLM engine initialized successfully');
      
    } catch (error) {
      const errorMsg = `Failed to initialize WebLLM: ${(error as Error).message}`;
      this.log(`✗ ${errorMsg}`);
      this.log('Please check:');
      this.log('1. Chrome version >= 113');
      this.log('2. At least 4GB RAM available');
      this.log('3. Sufficient disk space (~4GB for model)');
      await this.sendProgress(errorMsg, 0, true);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private handleProgress(report: { progress: number; text: string; timeElapsed?: number }): void {
    const stage = report.text || 'Loading...';
    const progress = report.progress;
    
    this.log(`Progress: ${Math.round(progress * 100)}% - ${stage}`);
    this.sendProgress(stage, progress, false);
  }

  private async sendProgress(stage: string, progress: number, isError: boolean = false): Promise<void> {
    const message: ModelProgressMessage = {
      type: 'MODEL_PROGRESS',
      payload: {
        progress: progress,
        stage: stage,
        timeElapsed: 0
      }
    };

    if (isError) {
      (message as any).error = stage;
    }

    try {
      await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('[Offscreen] Failed to send progress update:', error);
    }
  }

  private async handleChatMessage(
    message: ChatMessage, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    if (!this.engine) {
      this.log('Engine not initialized, initializing now...');
      await this.initializeEngine();
    }

    if (!this.engine) {
      const errorMsg = 'Model not initialized';
      this.log(`✗ ${errorMsg}`);
      sendResponse({ error: errorMsg });
      return;
    }

    try {
      this.log(`Processing chat message: "${message.payload.message.substring(0, 50)}..."`);
      
      const prompt = this.buildPrompt(message.payload.context, message.payload.message);
      
      this.log('Generating response...');
      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }] as ChatCompletionMessageParam[],
        stream: false,
        max_tokens: 800,
        temperature: 0.7
      });

      const reply = response.choices[0]?.message?.content || 'No response generated';
      
      this.log(`✓ Response generated (${reply.length} chars)`);
      
      sendResponse({
        type: 'CHAT_REPLY',
        payload: { text: reply }
      });
      
    } catch (error) {
      const errorMsg = `Chat error: ${(error as Error).message}`;
      this.log(`✗ ${errorMsg}`);
      sendResponse({ error: errorMsg });
    }
  }

  private buildPrompt(context: string | undefined, question: string): string {
    if (!context || context.length < 50) {
      return `Please answer the following question:\n\n${question}`;
    }

    // Limit context to avoid token limits
    const truncatedContext = context.substring(0, 4000);

    return `You are a helpful AI assistant. Based on the following document content, please answer the user's question accurately and concisely.

DOCUMENT CONTENT:
${truncatedContext}

USER QUESTION: ${question}

Please provide a helpful answer based on the document content. If the document doesn't contain relevant information to answer the question, please say so politely.`;
  }
}

// Initialize the offscreen application
new OffscreenApp();

