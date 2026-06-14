import { CreateMLCEngine, MLCEngineInterface } from '@mlc-ai/web-llm';
import { Wllama } from '@wllama/wllama/esm/index.js';

export interface LLMEngine {
  init(onProgress: (status: string, progress: number) => void): Promise<void>;
  generate(prompt: string, onChunk: (text: string) => void): Promise<string>;
  unload(): Promise<void>;
  readonly tier: 'builtin' | 'webgpu' | 'wasm';
}

// Helper to check Prompt API compatibility across different browser spec drafts
async function checkBuiltInAvailability(): Promise<'available' | 'downloadable' | 'no'> {
  try {
    // 0. Try global LanguageModel (modern Chrome)
    const GlobalLanguageModel = (window as any).LanguageModel || (self as any).LanguageModel;
    if (GlobalLanguageModel && typeof GlobalLanguageModel.availability === 'function') {
      const status = await GlobalLanguageModel.availability();
      if (status === 'available' || status === 'readily') return 'available';
      if (status === 'downloadable' || status === 'downloading' || status === 'after-download') return 'downloadable';
      return 'no';
    }

    const ai = (window as any).ai || (window as any).chrome?.aiOriginTrial;
    if (!ai || !ai.languageModel) return 'no';

    // 1. Try capabilities() (newest specification)
    if (typeof ai.languageModel.capabilities === 'function') {
      const caps = await ai.languageModel.capabilities();
      const status = caps.available;
      if (status === 'readily') return 'available';
      if (status === 'after-download') return 'downloadable';
      return 'no';
    }

    // 2. Try availability() (transitional specification)
    if (typeof ai.languageModel.availability === 'function') {
      const status = await ai.languageModel.availability();
      if (status === 'available') return 'available';
      if (status === 'downloadable' || status === 'downloading') return 'downloadable';
      return 'no';
    }

    // 3. Legacy check
    if (typeof ai.languageModel.create === 'function' || typeof (window as any).ai?.createTextSession === 'function') {
      return 'available';
    }

    return 'no';
  } catch {
    return 'no';
  }
}

// Tier 0: Chrome Prompt API (Built-in Gemini Nano)
export class ChromePromptEngine implements LLMEngine {
  readonly tier = 'builtin';
  private session: any = null;

  async init(onProgress: (status: string, progress: number) => void): Promise<void> {
    onProgress('Connecting to Chrome Built-in AI...', 0.5);
    const availability = await checkBuiltInAvailability();
    if (availability === 'no') {
      throw new Error('Chrome Prompt API (Gemini Nano) is not supported or available on this device.');
    }

    onProgress('Initializing built-in language model...', 0.8);
    const GlobalLanguageModel = (window as any).LanguageModel || (self as any).LanguageModel;
    const ai = (window as any).ai || (window as any).chrome?.aiOriginTrial;

    if (GlobalLanguageModel && typeof GlobalLanguageModel.create === 'function') {
      this.session = await GlobalLanguageModel.create({
        systemPrompt: 'You are a helpful local AI assistant that answers questions based on document snippets. Be precise and keep answers concise.'
      });
    } else if (ai && ai.languageModel && typeof ai.languageModel.create === 'function') {
      this.session = await ai.languageModel.create({
        systemPrompt: 'You are a helpful local AI assistant that answers questions based on document snippets. Be precise and keep answers concise.'
      });
    } else if (typeof (window as any).ai?.createTextSession === 'function') {
      this.session = await (window as any).ai.createTextSession({
        systemPrompt: 'You are a helpful local AI assistant that answers questions based on document snippets. Be precise and keep answers concise.'
      });
    } else {
      throw new Error('No valid Prompt API initialization method found.');
    }
    
    onProgress('Chrome Built-in AI ready!', 1.0);
  }

  async generate(prompt: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.session) {
      throw new Error('Chrome built-in AI session is not initialized.');
    }

    const stream = this.session.promptStreaming(prompt);
    let fullText = '';
    let prevLength = 0;

    for await (const chunk of stream) {
      fullText = chunk;
      const delta = chunk.substring(prevLength);
      prevLength = chunk.length;
      onChunk(delta);
    }

    return fullText;
  }

  async unload(): Promise<void> {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}

// Tier 1: WebLLM (WebGPU-accelerated LLM)
export class WebGPUEngine implements LLMEngine {
  readonly tier = 'webgpu';
  private engine: MLCEngineInterface | null = null;
  private modelId = 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'; // Optimized 1.5B model

  async init(onProgress: (status: string, progress: number) => void): Promise<void> {
    onProgress('Checking WebGPU support...', 0.1);
    if (!(navigator as any).gpu) {
      throw new Error('WebGPU is not supported by your browser/device.');
    }
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No compatible GPU adapter found.');
    }

    onProgress('Initializing WebGPU Engine...', 0.2);
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (report) => {
        onProgress(report.text, report.progress);
      }
    });
  }

  async generate(prompt: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.engine) {
      throw new Error('WebGPU Engine not initialized.');
    }

    const response = await this.engine.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: true,
      max_tokens: 800,
      temperature: 0.7
    });

    let fullText = '';
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }

    return fullText;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
  }
}

// Tier 2: Wllama (WASM llama.cpp running on CPU fallback)
export class WasmEngine implements LLMEngine {
  readonly tier = 'wasm';
  private wllama: Wllama | null = null;
  // SmolLM2-360M is tiny (~240MB) and very CPU friendly
  private modelUrl = 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf';

  async init(onProgress: (status: string, progress: number) => void): Promise<void> {
    onProgress('Loading WebAssembly modules...', 0.1);
    
    // Instantiate wllama
    this.wllama = new Wllama({
      'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.4.0/dist/single-thread/wllama.wasm',
      'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.4.0/dist/multi-thread/wllama.wasm',
    });

    onProgress('Downloading CPU model...', 0.2);
    await this.wllama.loadModelFromUrl(this.modelUrl, {
      progressCallback: ({ loaded, total }) => {
        const progress = loaded / total;
        onProgress(`Downloading CPU Model: ${Math.round(progress * 100)}%`, progress);
      }
    });

    onProgress('CPU Model loaded successfully!', 1.0);
  }

  async generate(prompt: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.wllama) {
      throw new Error('Wasm Engine not initialized.');
    }

    // Format prompt simple style
    const formattedPrompt = `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;
    
    let fullText = '';
    const decoder = new TextDecoder('utf-8');
    const response = await this.wllama.createCompletion(formattedPrompt, {
      onNewToken: (token: number, piece: Uint8Array) => {
        const textPiece = decoder.decode(piece);
        fullText += textPiece;
        onChunk(textPiece);
      },
      sampling: {
        temp: 0.7,
      },
      nPredict: 800
    });

    return response;
  }

  async unload(): Promise<void> {
    if (this.wllama) {
      await this.wllama.exit();
      this.wllama = null;
    }
  }
}

// Probes capabilities and returns recommended engines order
export async function probeEngineCapabilities(): Promise<Array<'builtin' | 'webgpu' | 'wasm'>> {
  const tiers: Array<'builtin' | 'webgpu' | 'wasm'> = [];

  // Check Chrome Prompt API
  try {
    const availability = await checkBuiltInAvailability();
    if (availability === 'available' || availability === 'downloadable') {
      tiers.push('builtin');
    }
  } catch (e) {
    console.log('Built-in AI check failed:', e);
  }

  // Check WebGPU
  try {
    if ((navigator as any).gpu) {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        tiers.push('webgpu');
      }
    }
  } catch (e) {
    console.log('WebGPU check failed:', e);
  }

  // WASM is always supported
  tiers.push('wasm');

  return tiers;
}
