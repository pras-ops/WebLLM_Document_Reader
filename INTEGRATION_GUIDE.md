# 🔌 Integration Guide: Adding WebLLM Chat to Your Project

This guide shows you how to add the local AI chat feature to **any web project** (React, Vue, vanilla JS, etc.) or **any Chrome extension**.

---

## 📋 Table of Contents

1. [Quick Overview](#quick-overview)
2. [Core Components](#core-components)
3. [Integration into Web Apps](#integration-into-web-apps)
4. [Integration into Chrome Extensions](#integration-into-chrome-extensions)
5. [Minimal Example](#minimal-example)
6. [Full Integration Steps](#full-integration-steps)
7. [Logging & Debugging](#logging--debugging)
8. [File Upload & Tab Reading](#file-upload--tab-reading)

---

## 🎯 Quick Overview

**What you're integrating:**
- Local AI chat powered by WebLLM
- Runs entirely in the browser (no backend needed)
- Uses WebGPU for hardware acceleration
- ~1.7GB model (Llama 3.2 3B)

**What you need:**
- Modern browser with WebGPU support
- User's GPU for inference
- NPM package: `@mlc-ai/web-llm`

---

## 🧩 Core Components

### **Three Main Parts:**

```
┌─────────────────────────────────────────┐
│  1. UI Layer (Your Chat Interface)     │  ← Your custom UI
├─────────────────────────────────────────┤
│  2. WebLLM Manager (AI Engine)          │  ← Core logic (copy this)
├─────────────────────────────────────────┤
│  3. WebGPU + Model (Browser APIs)       │  ← Built-in browser features
└─────────────────────────────────────────┘
```

### **Files You Need:**

From this project, you only need **ONE core file concept**:
- **WebLLM Integration Logic** (found in `src/offscreen/offscreen.ts`)

Everything else is customizable to your project.

---

## 🌐 Integration into Web Apps

### **For React, Vue, Angular, Vanilla JS, etc.**

#### **Step 1: Install Dependencies**

```bash
npm install @mlc-ai/web-llm
```

#### **Step 2: Create WebLLM Manager Class**

Create a new file: `src/services/WebLLMManager.ts` (or `.js`)

```typescript
import * as webllm from "@mlc-ai/web-llm";

export class WebLLMManager {
  private engine: webllm.MLCEngine | null = null;
  private isInitialized: boolean = false;

  // Initialize the AI engine
  async initialize(
    onProgress?: (report: { text: string; progress: number }) => void
  ): Promise<void> {
    if (this.isInitialized) return;

    const initProgressCallback = (report: webllm.InitProgressReport) => {
      console.log(report.text, report.progress);
      onProgress?.({ text: report.text, progress: report.progress });
    };

    this.engine = await webllm.CreateMLCEngine(
      "Llama-3.2-3B-Instruct-q4f32_1-MLC", // Model name
      {
        initProgressCallback: initProgressCallback,
      }
    );

    this.isInitialized = true;
  }

  // Send a message and get response
  async chat(
    userMessage: string,
    context?: string,
    onStream?: (text: string) => void
  ): Promise<string> {
    if (!this.engine) {
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    // Build the prompt
    const systemPrompt = context
      ? `You are a helpful assistant. Here is some context:\n\n${context}`
      : "You are a helpful assistant.";

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // Generate response
    let fullResponse = "";

    const completion = await this.engine.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true, // Enable streaming
    });

    // Stream the response
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullResponse += delta;
      onStream?.(fullResponse); // Call callback with accumulated text
    }

    return fullResponse;
  }

  // Clean up resources
  async dispose(): Promise<void> {
    if (this.engine) {
      // Engine cleanup (if needed)
      this.engine = null;
      this.isInitialized = false;
    }
  }
}
```

#### **Step 3: Use in Your Component**

**React Example:**

```tsx
import React, { useState, useEffect } from 'react';
import { WebLLMManager } from './services/WebLLMManager';

function ChatComponent() {
  const [llm] = useState(() => new WebLLMManager());
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize on mount
  useEffect(() => {
    llm.initialize((report) => {
      setProgress(`${report.text} (${Math.round(report.progress * 100)}%)`);
      if (report.progress === 1) {
        setIsReady(true);
        setProgress('Model ready!');
      }
    });

    return () => {
      llm.dispose();
    };
  }, [llm]);

  const handleSend = async () => {
    if (!message.trim() || !isReady) return;

    setLoading(true);
    setResponse('');

    try {
      await llm.chat(
        message,
        undefined, // No context (or pass document text here)
        (text) => setResponse(text) // Stream response
      );
    } catch (error) {
      console.error('Chat error:', error);
      setResponse('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Local AI Chat</h2>
      
      {!isReady && <p>Loading model: {progress}</p>}
      
      {isReady && (
        <>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask me anything..."
            rows={4}
          />
          <button onClick={handleSend} disabled={loading}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
          
          {response && (
            <div>
              <h3>Response:</h3>
              <p>{response}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ChatComponent;
```

**Vue Example:**

```vue
<template>
  <div>
    <h2>Local AI Chat</h2>
    
    <p v-if="!isReady">Loading: {{ progress }}</p>
    
    <div v-if="isReady">
      <textarea 
        v-model="message" 
        placeholder="Ask me anything..."
        rows="4"
      ></textarea>
      <button @click="handleSend" :disabled="loading">
        {{ loading ? 'Thinking...' : 'Send' }}
      </button>
      
      <div v-if="response">
        <h3>Response:</h3>
        <p>{{ response }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { WebLLMManager } from './services/WebLLMManager';

export default {
  data() {
    return {
      llm: new WebLLMManager(),
      isReady: false,
      progress: '',
      message: '',
      response: '',
      loading: false,
    };
  },
  async mounted() {
    await this.llm.initialize((report) => {
      this.progress = `${report.text} (${Math.round(report.progress * 100)}%)`;
      if (report.progress === 1) {
        this.isReady = true;
      }
    });
  },
  methods: {
    async handleSend() {
      if (!this.message.trim() || !this.isReady) return;
      
      this.loading = true;
      this.response = '';
      
      try {
        await this.llm.chat(
          this.message,
          undefined,
          (text) => { this.response = text; }
        );
      } catch (error) {
        this.response = 'Error: ' + error.message;
      } finally {
        this.loading = false;
      }
    }
  },
  beforeUnmount() {
    this.llm.dispose();
  }
};
</script>
```

**Vanilla JavaScript Example:**

```javascript
import { WebLLMManager } from './services/WebLLMManager.js';

const llm = new WebLLMManager();
let isReady = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  
  await llm.initialize((report) => {
    statusEl.textContent = `${report.text} (${Math.round(report.progress * 100)}%)`;
    if (report.progress === 1) {
      isReady = true;
      statusEl.textContent = 'Ready!';
    }
  });
});

// Handle send button
document.getElementById('sendBtn').addEventListener('click', async () => {
  if (!isReady) return;
  
  const input = document.getElementById('messageInput');
  const output = document.getElementById('response');
  
  output.textContent = 'Thinking...';
  
  const response = await llm.chat(
    input.value,
    undefined,
    (text) => { output.textContent = text; }
  );
});
```

---

## 🔌 Integration into Chrome Extensions

### **For Existing Chrome Extensions**

If you already have a Chrome extension and want to add AI chat:

#### **Step 1: Update `manifest.json`**

Add these permissions:

```json
{
  "manifest_version": 3,
  "permissions": [
    "offscreen",
    "storage"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

#### **Step 2: Add Dependencies**

```bash
npm install @mlc-ai/web-llm
```

#### **Step 3: Create Offscreen Document**

**Why?** Chrome extensions use service workers which can't run WebGPU. You need an offscreen document.

Create `src/offscreen/offscreen.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebLLM Offscreen</title>
</head>
<body>
  <script src="offscreen.js"></script>
</body>
</html>
```

Create `src/offscreen/offscreen.ts`:

```typescript
import * as webllm from "@mlc-ai/web-llm";

let engine: webllm.MLCEngine | null = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INIT_MODEL") {
    initializeModel(message.onProgress).then(() => {
      sendResponse({ success: true });
    });
    return true; // Async response
  }

  if (message.type === "CHAT") {
    chat(message.userMessage, message.context).then((response) => {
      sendResponse({ response });
    });
    return true;
  }
});

async function initializeModel(onProgress?: boolean) {
  if (engine) return;

  engine = await webllm.CreateMLCEngine(
    "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    {
      initProgressCallback: (report) => {
        // Send progress updates to background script
        chrome.runtime.sendMessage({
          type: "INIT_PROGRESS",
          progress: report.progress,
          text: report.text,
        });
      },
    }
  );
}

async function chat(userMessage: string, context?: string): Promise<string> {
  if (!engine) throw new Error("Engine not initialized");

  const systemPrompt = context
    ? `You are a helpful assistant. Context:\n\n${context}`
    : "You are a helpful assistant.";

  const messages: webllm.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 512,
  });

  return reply.choices[0].message.content || "";
}
```

#### **Step 4: Update Background Script**

Create or update `src/background.ts`:

```typescript
// Create offscreen document if needed
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: 'Run WebLLM for AI chat',
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  await setupOffscreenDocument();
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHAT_WITH_AI") {
    // Forward to offscreen document
    chrome.runtime.sendMessage({
      type: "CHAT",
      userMessage: message.userMessage,
      context: message.context,
    }, (response) => {
      sendResponse(response);
    });
    return true;
  }
});
```

#### **Step 5: Use in Your Popup/Content Script**

```typescript
// From popup or content script
async function askAI(question: string, context?: string) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "CHAT_WITH_AI",
        userMessage: question,
        context: context,
      },
      (response) => {
        resolve(response.response);
      }
    );
  });
}

// Usage
const answer = await askAI("What is this document about?", documentText);
console.log(answer);
```

---

## ⚡ Minimal Example (Copy-Paste Ready)

### **HTML File (index.html)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Local AI Chat</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; }
    #status { padding: 10px; background: #f0f0f0; border-radius: 5px; }
    textarea { width: 100%; padding: 10px; margin: 10px 0; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #response { margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 5px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>🤖 Local AI Chat</h1>
  <div id="status">Initializing...</div>
  
  <div id="chatInterface" style="display: none;">
    <textarea id="messageInput" rows="4" placeholder="Ask me anything..."></textarea>
    <button id="sendBtn">Send</button>
    <div id="response" style="display: none;"></div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

### **JavaScript File (app.js)**

```javascript
import * as webllm from "@mlc-ai/web-llm";

let engine = null;

// Initialize
async function init() {
  const statusEl = document.getElementById('status');
  const chatInterface = document.getElementById('chatInterface');
  
  engine = await webllm.CreateMLCEngine(
    "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    {
      initProgressCallback: (report) => {
        statusEl.textContent = `Loading: ${report.text} (${Math.round(report.progress * 100)}%)`;
        if (report.progress === 1) {
          statusEl.textContent = '✅ Model Ready!';
          chatInterface.style.display = 'block';
        }
      },
    }
  );
}

// Send message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const output = document.getElementById('response');
  const btn = document.getElementById('sendBtn');
  
  if (!input.value.trim()) return;
  
  btn.disabled = true;
  output.style.display = 'block';
  output.textContent = 'Thinking...';
  
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: input.value }
  ];
  
  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 512,
  });
  
  output.textContent = reply.choices[0].message.content;
  btn.disabled = false;
}

// Setup
document.getElementById('sendBtn').addEventListener('click', sendMessage);
init();
```

### **Package.json**

```json
{
  "name": "local-ai-chat",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@mlc-ai/web-llm": "^0.2.46"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

### **Run It:**

```bash
npm install
npm run dev
```

---

## 📦 Full Integration Steps

### **1. Prerequisites**

- ✅ Node.js 18+
- ✅ Modern browser with WebGPU
- ✅ GPU with WebGPU support
- ✅ Enable WebGPU: `chrome://flags` → Enable "Unsafe WebGPU"

### **2. Install Package**

```bash
npm install @mlc-ai/web-llm
```

### **3. Choose Integration Method**

| Your Project Type | Integration Method |
|-------------------|-------------------|
| React/Vue/Angular | Use WebLLMManager class (see above) |
| Vanilla JS | Direct import (minimal example) |
| Chrome Extension | Offscreen document pattern (see above) |
| Next.js/Server | Client-side only (use dynamic import) |

### **4. Handle Models**

**Available Models:**

```typescript
// Smaller, faster (500MB)
"Llama-3.2-1B-Instruct-q4f32_1-MLC"

// Balanced (1.7GB) - RECOMMENDED
"Llama-3.2-3B-Instruct-q4f32_1-MLC"

// Larger, better quality (4GB+)
"Llama-3.1-8B-Instruct-q4f32_1-MLC"
```

### **5. Enable WebGPU**

Users must enable WebGPU in their browser:

```
chrome://flags → Search "WebGPU" → Enable → Restart
```

### **6. Add Document Context (Optional)**

To chat about documents:

```typescript
// Extract text from webpage
const documentText = document.body.innerText;

// Pass as context
await llm.chat(
  "Summarize this document",
  documentText, // Context
  (response) => console.log(response)
);
```

---

## 🐛 Logging & Debugging

### **Enhanced WebLLMManager with Logging**

Add comprehensive logging to track initialization, performance, and errors:

```typescript
import * as webllm from "@mlc-ai/web-llm";

export interface LogEvent {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'init' | 'chat' | 'performance' | 'error';
  message: string;
  data?: any;
}

export class WebLLMManager {
  private engine: webllm.MLCEngine | null = null;
  private isInitialized: boolean = false;
  private logs: LogEvent[] = [];
  private debugMode: boolean = false;
  
  // Performance tracking
  private metrics = {
    initStartTime: 0,
    initEndTime: 0,
    lastChatStartTime: 0,
    lastChatEndTime: 0,
    totalChats: 0,
    totalTokens: 0,
  };

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
    this.log('info', 'init', 'WebLLMManager created');
  }

  // Core logging method
  private log(
    level: LogEvent['level'],
    category: LogEvent['category'],
    message: string,
    data?: any
  ): void {
    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(event);

    // Console output with colors
    const prefix = `[WebLLM:${category.toUpperCase()}]`;
    const timestamp = new Date().toLocaleTimeString();
    
    if (this.debugMode) {
      switch (level) {
        case 'error':
          console.error(`${prefix} ${timestamp}`, message, data || '');
          break;
        case 'warn':
          console.warn(`${prefix} ${timestamp}`, message, data || '');
          break;
        case 'info':
          console.info(`${prefix} ${timestamp}`, message, data || '');
          break;
        case 'debug':
          console.debug(`${prefix} ${timestamp}`, message, data || '');
          break;
      }
    }
  }

  // Initialize with detailed logging
  async initialize(
    modelName: string = "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    onProgress?: (report: { text: string; progress: number }) => void
  ): Promise<void> {
    if (this.isInitialized) {
      this.log('warn', 'init', 'Already initialized, skipping');
      return;
    }

    this.log('info', 'init', `Starting initialization with model: ${modelName}`);
    this.metrics.initStartTime = Date.now();

    try {
      const initProgressCallback = (report: webllm.InitProgressReport) => {
        this.log('debug', 'init', report.text, { 
          progress: report.progress,
          progressPercentage: `${(report.progress * 100).toFixed(1)}%`
        });
        
        onProgress?.({ 
          text: report.text, 
          progress: report.progress 
        });
      };

      this.engine = await webllm.CreateMLCEngine(modelName, {
        initProgressCallback: initProgressCallback,
      });

      this.metrics.initEndTime = Date.now();
      const initDuration = this.metrics.initEndTime - this.metrics.initStartTime;
      
      this.isInitialized = true;
      this.log('info', 'init', `Initialization successful in ${(initDuration / 1000).toFixed(2)}s`, {
        duration: initDuration,
        model: modelName,
      });

    } catch (error) {
      this.metrics.initEndTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('error', 'error', `Initialization failed: ${errorMessage}`, {
        error: error,
        duration: this.metrics.initEndTime - this.metrics.initStartTime,
      });
      
      throw error;
    }
  }

  // Chat with detailed logging
  async chat(
    userMessage: string,
    context?: string,
    onStream?: (text: string) => void
  ): Promise<string> {
    if (!this.engine) {
      const error = 'Engine not initialized. Call initialize() first.';
      this.log('error', 'error', error);
      throw new Error(error);
    }

    this.log('info', 'chat', 'Starting chat', {
      messageLength: userMessage.length,
      hasContext: !!context,
      contextLength: context?.length || 0,
    });

    this.metrics.lastChatStartTime = Date.now();
    this.metrics.totalChats++;

    try {
      const systemPrompt = context
        ? `You are a helpful assistant. Here is some context:\n\n${context}`
        : "You are a helpful assistant.";

      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];

      let fullResponse = "";
      let tokenCount = 0;
      let firstTokenTime = 0;

      this.log('debug', 'chat', 'Generating completion...');

      const completion = await this.engine.chat.completions.create({
        messages: messages,
        temperature: 0.7,
        max_tokens: 512,
        stream: true,
      });

      // Stream response with token tracking
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || "";
        
        if (delta && tokenCount === 0) {
          firstTokenTime = Date.now();
          const timeToFirstToken = firstTokenTime - this.metrics.lastChatStartTime;
          this.log('debug', 'performance', `Time to first token: ${timeToFirstToken}ms`);
        }

        fullResponse += delta;
        tokenCount++;
        onStream?.(fullResponse);
      }

      this.metrics.lastChatEndTime = Date.now();
      this.metrics.totalTokens += tokenCount;

      const chatDuration = this.metrics.lastChatEndTime - this.metrics.lastChatStartTime;
      const tokensPerSecond = (tokenCount / (chatDuration / 1000)).toFixed(2);

      this.log('info', 'chat', 'Chat completed successfully', {
        duration: chatDuration,
        tokens: tokenCount,
        tokensPerSecond: tokensPerSecond,
        responseLength: fullResponse.length,
      });

      this.log('info', 'performance', `Performance: ${tokensPerSecond} tokens/sec`, {
        totalChats: this.metrics.totalChats,
        totalTokens: this.metrics.totalTokens,
      });

      return fullResponse;

    } catch (error) {
      this.metrics.lastChatEndTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('error', 'error', `Chat failed: ${errorMessage}`, {
        error: error,
        duration: this.metrics.lastChatEndTime - this.metrics.lastChatStartTime,
      });
      
      throw error;
    }
  }

  // Get all logs
  getLogs(): LogEvent[] {
    return [...this.logs];
  }

  // Get logs by category
  getLogsByCategory(category: LogEvent['category']): LogEvent[] {
    return this.logs.filter(log => log.category === category);
  }

  // Get performance metrics
  getMetrics() {
    const avgTokensPerChat = this.metrics.totalChats > 0 
      ? (this.metrics.totalTokens / this.metrics.totalChats).toFixed(1)
      : '0';

    return {
      ...this.metrics,
      initDuration: this.metrics.initEndTime - this.metrics.initStartTime,
      lastChatDuration: this.metrics.lastChatEndTime - this.metrics.lastChatStartTime,
      avgTokensPerChat: avgTokensPerChat,
    };
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs
  clearLogs(): void {
    this.log('info', 'init', 'Clearing logs');
    this.logs = [];
  }

  // Clean up
  async dispose(): Promise<void> {
    this.log('info', 'init', 'Disposing WebLLMManager', {
      totalChats: this.metrics.totalChats,
      totalTokens: this.metrics.totalTokens,
    });
    
    if (this.engine) {
      this.engine = null;
      this.isInitialized = false;
    }
  }
}
```

### **Usage Example with Logging**

```typescript
// Create with debug mode enabled
const llm = new WebLLMManager(true); // Enable debug logging

// Initialize with progress tracking
await llm.initialize(
  "Llama-3.2-3B-Instruct-q4f32_1-MLC",
  (report) => {
    console.log(`Loading: ${report.text} (${(report.progress * 100).toFixed(1)}%)`);
  }
);

// Chat and track performance
const response = await llm.chat(
  "Explain quantum computing",
  undefined,
  (streamText) => {
    console.log("Streaming:", streamText.length, "characters");
  }
);

// Get performance metrics
const metrics = llm.getMetrics();
console.log("Performance Metrics:", {
  initTime: `${(metrics.initDuration / 1000).toFixed(2)}s`,
  lastChatTime: `${(metrics.lastChatDuration / 1000).toFixed(2)}s`,
  totalChats: metrics.totalChats,
  totalTokens: metrics.totalTokens,
  avgTokensPerChat: metrics.avgTokensPerChat,
});

// Export logs for debugging
const logs = llm.exportLogs();
console.log("Full logs:", logs);

// Or filter by category
const errors = llm.getLogsByCategory('error');
console.log("Errors:", errors);
```

### **Console Output Example**

With debug mode enabled, you'll see:

```
[WebLLM:INIT] 10:30:45 WebLLMManager created
[WebLLM:INIT] 10:30:45 Starting initialization with model: Llama-3.2-3B-Instruct-q4f32_1-MLC
[WebLLM:INIT] 10:30:47 Loading model from cache... { progress: 0.1, progressPercentage: '10.0%' }
[WebLLM:INIT] 10:30:50 Loading GPU shaders... { progress: 0.5, progressPercentage: '50.0%' }
[WebLLM:INIT] 10:30:58 Initialization successful in 13.24s { duration: 13240, model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC' }
[WebLLM:CHAT] 10:31:15 Starting chat { messageLength: 24, hasContext: false, contextLength: 0 }
[WebLLM:CHAT] 10:31:15 Generating completion...
[WebLLM:PERFORMANCE] 10:31:17 Time to first token: 1842ms
[WebLLM:CHAT] 10:31:32 Chat completed successfully { duration: 17234, tokens: 128, tokensPerSecond: '7.43', responseLength: 543 }
[WebLLM:PERFORMANCE] 10:31:32 Performance: 7.43 tokens/sec { totalChats: 1, totalTokens: 128 }
```

### **React Component with Logging**

```tsx
import React, { useState, useEffect } from 'react';
import { WebLLMManager } from './services/WebLLMManager';

function ChatWithLogging() {
  const [llm] = useState(() => new WebLLMManager(true)); // Debug mode
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Update metrics every second
    const interval = setInterval(() => {
      setMetrics(llm.getMetrics());
      setLogs(llm.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, [llm]);

  return (
    <div>
      <h2>Chat Interface</h2>
      
      {/* Performance Dashboard */}
      {metrics && (
        <div style={{ padding: '10px', background: '#f0f0f0', marginBottom: '10px' }}>
          <h3>📊 Performance Metrics</h3>
          <p>Init Time: {(metrics.initDuration / 1000).toFixed(2)}s</p>
          <p>Total Chats: {metrics.totalChats}</p>
          <p>Total Tokens: {metrics.totalTokens}</p>
          <p>Avg Tokens/Chat: {metrics.avgTokensPerChat}</p>
          <p>Last Chat: {(metrics.lastChatDuration / 1000).toFixed(2)}s</p>
        </div>
      )}

      {/* Log Viewer */}
      <div style={{ maxHeight: '300px', overflow: 'auto', background: '#000', color: '#0f0', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
        <h3 style={{ color: '#0f0' }}>🔍 Live Logs</h3>
        {logs.map((log, idx) => (
          <div key={idx} style={{ 
            color: log.level === 'error' ? '#f00' : log.level === 'warn' ? '#ff0' : '#0f0' 
          }}>
            [{new Date(log.timestamp).toLocaleTimeString()}] 
            [{log.category.toUpperCase()}] 
            {log.message}
            {log.data && ` - ${JSON.stringify(log.data)}`}
          </div>
        ))}
      </div>

      {/* Export Logs Button */}
      <button onClick={() => {
        const logData = llm.exportLogs();
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webllm-logs-${Date.now()}.json`;
        a.click();
      }}>
        📥 Download Logs
      </button>
    </div>
  );
}
```

### **Chrome Extension Logging**

For Chrome extensions, add logging to the offscreen document:

```typescript
// offscreen.ts
import * as webllm from "@mlc-ai/web-llm";

const DEBUG = true; // Enable/disable logging

function log(level: string, message: string, data?: any) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[WebLLM-Offscreen]`;
  
  console[level](`${prefix} ${timestamp}`, message, data || '');
  
  // Also send to background script for centralized logging
  chrome.runtime.sendMessage({
    type: 'LOG',
    level,
    message,
    data,
    timestamp: Date.now(),
  });
}

let engine: webllm.MLCEngine | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('info', 'Received message', { type: message.type });

  if (message.type === "INIT_MODEL") {
    log('info', 'Starting model initialization');
    const startTime = Date.now();

    initializeModel()
      .then(() => {
        const duration = Date.now() - startTime;
        log('info', `Model initialized in ${(duration / 1000).toFixed(2)}s`, { duration });
        sendResponse({ success: true, duration });
      })
      .catch((error) => {
        log('error', 'Initialization failed', { error: error.message });
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (message.type === "CHAT") {
    log('info', 'Starting chat', {
      messageLength: message.userMessage.length,
      hasContext: !!message.context,
    });
    
    const startTime = Date.now();

    chat(message.userMessage, message.context)
      .then((response) => {
        const duration = Date.now() - startTime;
        log('info', 'Chat completed', {
          duration,
          responseLength: response.length,
          tokensPerSec: ((response.length / 4) / (duration / 1000)).toFixed(2),
        });
        sendResponse({ response, duration });
      })
      .catch((error) => {
        log('error', 'Chat failed', { error: error.message });
        sendResponse({ error: error.message });
      });

    return true;
  }
});

async function initializeModel() {
  if (engine) {
    log('warn', 'Engine already initialized');
    return;
  }

  try {
    engine = await webllm.CreateMLCEngine(
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      {
        initProgressCallback: (report) => {
          log('debug', report.text, { progress: (report.progress * 100).toFixed(1) + '%' });
          
          // Send progress to background
          chrome.runtime.sendMessage({
            type: "INIT_PROGRESS",
            progress: report.progress,
            text: report.text,
          });
        },
      }
    );
    
    log('info', 'Engine created successfully');
  } catch (error) {
    log('error', 'Engine creation failed', error);
    throw error;
  }
}

async function chat(userMessage: string, context?: string): Promise<string> {
  if (!engine) {
    log('error', 'Engine not initialized');
    throw new Error("Engine not initialized");
  }

  const messages = [
    { role: "system", content: context || "You are a helpful assistant." },
    { role: "user", content: userMessage },
  ];

  log('debug', 'Creating completion', { messages });

  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 512,
  });

  const response = reply.choices[0].message.content || "";
  log('debug', 'Got response', { length: response.length });

  return response;
}
```

### **Performance Monitoring Dashboard**

Create a simple performance dashboard:

```html
<!-- performance-dashboard.html -->
<div id="performance-dashboard">
  <h3>⚡ WebLLM Performance</h3>
  <div class="metrics">
    <div class="metric">
      <span class="label">Status:</span>
      <span id="status" class="value">Initializing...</span>
    </div>
    <div class="metric">
      <span class="label">Init Time:</span>
      <span id="init-time" class="value">--</span>
    </div>
    <div class="metric">
      <span class="label">Last Response:</span>
      <span id="last-response-time" class="value">--</span>
    </div>
    <div class="metric">
      <span class="label">Tokens/sec:</span>
      <span id="tokens-per-sec" class="value">--</span>
    </div>
    <div class="metric">
      <span class="label">Total Chats:</span>
      <span id="total-chats" class="value">0</span>
    </div>
  </div>
</div>

<style>
  #performance-dashboard {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }
  .metric {
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 5px;
  }
  .label {
    font-size: 12px;
    opacity: 0.8;
  }
  .value {
    display: block;
    font-size: 18px;
    font-weight: bold;
    margin-top: 5px;
  }
</style>

<script>
  // Update dashboard with metrics
  function updateDashboard(metrics) {
    document.getElementById('status').textContent = metrics.isReady ? '✅ Ready' : '⏳ Loading';
    document.getElementById('init-time').textContent = `${(metrics.initDuration / 1000).toFixed(2)}s`;
    document.getElementById('last-response-time').textContent = `${(metrics.lastChatDuration / 1000).toFixed(2)}s`;
    document.getElementById('tokens-per-sec').textContent = metrics.tokensPerSec || '--';
    document.getElementById('total-chats').textContent = metrics.totalChats;
  }
</script>
```

### **Best Practices**

1. **Enable debug mode during development**
   ```typescript
   const llm = new WebLLMManager(true); // Development
   const llm = new WebLLMManager(false); // Production
   ```

2. **Monitor performance metrics**
   - Track tokens/second to identify performance issues
   - Monitor init time to detect caching problems
   - Log errors for debugging

3. **Export logs for bug reports**
   ```typescript
   const logs = llm.exportLogs();
   // Send to your error tracking service
   ```

4. **Use console groups for better organization**
   ```typescript
   console.group('WebLLM Chat');
   console.log('User:', message);
   console.log('Response:', response);
   console.groupEnd();
   ```

5. **Set up error tracking**
   ```typescript
   try {
     await llm.chat(message);
   } catch (error) {
     // Log to service like Sentry
     console.error('Chat failed:', error);
     // Send to error tracking
     if (window.Sentry) {
       Sentry.captureException(error);
     }
   }
   ```

---

## 🎯 Key Points

### **What Makes This Work:**

1. **WebLLM Package** - Handles AI inference in browser
2. **WebGPU** - Uses GPU for hardware acceleration
3. **Offscreen Document** - For Chrome extensions (service workers can't use WebGPU)
4. **Progressive Loading** - Model downloads once, cached forever

### **Performance Notes:**

- First load: 3-5 minutes (model download)
- Cached load: 10-60 seconds
- Response time: 10 seconds to 3 minutes (depends on GPU)
- Better GPU = Faster responses

### **Browser Compatibility:**

| Browser | WebGPU Support | Works? |
|---------|---------------|--------|
| Chrome 113+ | ✅ Yes | ✅ Yes |
| Edge 113+ | ✅ Yes | ✅ Yes |
| Firefox | ⚠️ Experimental | ⚠️ Maybe |
| Safari | ❌ Not yet | ❌ No |

---

## 🔧 Troubleshooting

### **"WebGPU not supported"**

- Enable at `chrome://flags`
- Check `chrome://gpu` shows "Hardware accelerated"
- Update Chrome to latest version
- Update GPU drivers

### **"Model failed to load"**

- Check internet connection (first time only)
- Clear browser cache
- Ensure 2-4GB free disk space
- Try smaller model (1B instead of 3B)

### **Slow responses**

- Close other tabs (free up RAM)
- Use smaller model
- Check GPU usage in Task Manager
- Consider hardware upgrade

---

## 📚 Additional Resources

- **WebLLM GitHub**: https://github.com/mlc-ai/web-llm
- **WebGPU Docs**: https://developer.chrome.com/blog/webgpu-release/
- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/

---

## 💡 Use Cases

### **Where You Can Add This:**

✅ **Documentation sites** - "Ask questions about these docs"  
✅ **Blog/article readers** - "Summarize this article"  
✅ **E-learning platforms** - "Explain this lesson"  
✅ **Note-taking apps** - "Chat with my notes"  
✅ **PDF viewers** - "Answer questions about this PDF"  
✅ **Code editors** - "Explain this code"  
✅ **Research tools** - "Analyze this paper"  

---

## 📁 File Upload & Tab Reading

Give users **two ways** to provide content to the AI:
1. **Upload files** (PDF, TXT, DOCX, etc.)
2. **Read current browser tab** automatically

### **Architecture Overview**

```
User Options:
├── 📤 Upload File → Extract Text → Chat with AI
└── 🌐 Read Current Tab → Extract Text → Chat with AI
```

---

### **Option 1: File Upload**

#### **HTML UI with File Upload**

```html
<!-- upload-interface.html -->
<div class="chat-container">
  <h2>🤖 Chat with Documents</h2>
  
  <!-- Input Method Tabs -->
  <div class="input-tabs">
    <button id="tab-upload" class="tab active">📤 Upload File</button>
    <button id="tab-current" class="tab">🌐 Read Current Tab</button>
  </div>

  <!-- File Upload Section -->
  <div id="upload-section" class="input-section">
    <div class="upload-area" id="dropZone">
      <input type="file" id="fileInput" accept=".pdf,.txt,.md,.doc,.docx" hidden>
      <label for="fileInput" class="upload-label">
        <div class="upload-icon">📄</div>
        <p>Click to upload or drag & drop</p>
        <small>Supported: PDF, TXT, MD, DOC, DOCX</small>
      </label>
    </div>
    <div id="file-info" style="display: none;">
      <p>📎 <span id="file-name"></span> (<span id="file-size"></span>)</p>
      <button id="remove-file">Remove</button>
    </div>
  </div>

  <!-- Current Tab Section -->
  <div id="current-section" class="input-section" style="display: none;">
    <div class="tab-preview">
      <h3>Current Tab Content</h3>
      <div id="tab-content-preview">Loading...</div>
      <button id="refresh-tab">🔄 Refresh</button>
    </div>
  </div>

  <!-- Chat Interface -->
  <div class="chat-box">
    <div id="chat-messages"></div>
    <div class="input-group">
      <textarea 
        id="user-message" 
        placeholder="Ask a question about the document..."
        rows="3"
      ></textarea>
      <button id="send-btn">Send</button>
    </div>
  </div>
</div>

<style>
  .chat-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .input-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .tab {
    flex: 1;
    padding: 12px;
    border: 2px solid #ddd;
    background: white;
    cursor: pointer;
    border-radius: 8px 8px 0 0;
    font-size: 16px;
  }
  
  .tab.active {
    background: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }
  
  .input-section {
    border: 2px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .upload-area {
    border: 3px dashed #ddd;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .upload-area:hover {
    border-color: #4CAF50;
    background: #f0f9f0;
  }
  
  .upload-area.dragover {
    border-color: #4CAF50;
    background: #e8f5e9;
  }
  
  .upload-icon {
    font-size: 48px;
    margin-bottom: 10px;
  }
  
  .tab-preview {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .chat-box {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
  }
  
  #chat-messages {
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 15px;
    padding: 10px;
    background: #fafafa;
    border-radius: 5px;
  }
  
  .message {
    margin: 10px 0;
    padding: 10px;
    border-radius: 5px;
  }
  
  .message.user {
    background: #e3f2fd;
    text-align: right;
  }
  
  .message.ai {
    background: #f1f8e9;
  }
  
  .input-group {
    display: flex;
    gap: 10px;
  }
  
  #user-message {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    resize: vertical;
  }
  
  button {
    padding: 10px 20px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }
  
  button:hover {
    background: #45a049;
  }
  
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
```

#### **JavaScript Implementation**

```typescript
import { WebLLMManager } from './services/WebLLMManager';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

class DocumentChat {
  private llm: WebLLMManager;
  private documentText: string = '';
  private currentMode: 'upload' | 'tab' = 'upload';

  constructor() {
    this.llm = new WebLLMManager(true);
    this.init();
  }

  async init() {
    // Initialize WebLLM
    await this.llm.initialize(
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      (report) => {
        console.log(`Loading: ${(report.progress * 100).toFixed(1)}%`);
      }
    );

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Tab switching
    document.getElementById('tab-upload')?.addEventListener('click', () => {
      this.switchMode('upload');
    });

    document.getElementById('tab-current')?.addEventListener('click', () => {
      this.switchMode('tab');
    });

    // File upload
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag & drop
    const dropZone = document.getElementById('dropZone');
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files[0]) {
        this.processFile(files[0]);
      }
    });

    // Remove file
    document.getElementById('remove-file')?.addEventListener('click', () => {
      this.clearFile();
    });

    // Refresh tab content
    document.getElementById('refresh-tab')?.addEventListener('click', () => {
      this.readCurrentTab();
    });

    // Send message
    document.getElementById('send-btn')?.addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter to send (Shift+Enter for new line)
    document.getElementById('user-message')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  switchMode(mode: 'upload' | 'tab') {
    this.currentMode = mode;

    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    if (mode === 'upload') {
      document.getElementById('tab-upload')?.classList.add('active');
      document.getElementById('upload-section')!.style.display = 'block';
      document.getElementById('current-section')!.style.display = 'none';
    } else {
      document.getElementById('tab-current')?.classList.add('active');
      document.getElementById('upload-section')!.style.display = 'none';
      document.getElementById('current-section')!.style.display = 'block';
      this.readCurrentTab();
    }
  }

  async handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      await this.processFile(input.files[0]);
    }
  }

  async processFile(file: File) {
    console.log('Processing file:', file.name);

    const fileType = file.name.split('.').pop()?.toLowerCase();

    try {
      switch (fileType) {
        case 'txt':
        case 'md':
          this.documentText = await this.readTextFile(file);
          break;
        case 'pdf':
          this.documentText = await this.readPDFFile(file);
          break;
        default:
          alert('Unsupported file type. Please use TXT, MD, or PDF.');
          return;
      }

      // Show file info
      document.getElementById('file-name')!.textContent = file.name;
      document.getElementById('file-size')!.textContent = this.formatFileSize(file.size);
      document.getElementById('file-info')!.style.display = 'block';
      
      // Hide upload area
      document.getElementById('dropZone')!.style.display = 'none';

      this.addMessage('system', `✅ Loaded: ${file.name} (${this.documentText.length} characters)`);

    } catch (error) {
      console.error('File processing error:', error);
      alert('Error processing file: ' + error);
    }
  }

  async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async readPDFFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n\n';
    }
    
    return text;
  }

  clearFile() {
    this.documentText = '';
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    document.getElementById('file-info')!.style.display = 'none';
    document.getElementById('dropZone')!.style.display = 'block';
  }

  async readCurrentTab() {
    const preview = document.getElementById('tab-content-preview');
    if (!preview) return;

    preview.textContent = 'Reading current tab...';

    // For Chrome Extension
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => document.body.innerText,
        });

        this.documentText = results[0].result || '';
        
      } catch (error) {
        console.error('Error reading tab:', error);
        preview.textContent = '❌ Unable to read tab (permissions needed)';
        return;
      }
    } else {
      // For regular web apps (same origin only)
      this.documentText = document.body.innerText;
    }

    const previewText = this.documentText.substring(0, 500) + '...';
    preview.textContent = previewText;
    
    this.addMessage('system', `✅ Read current tab (${this.documentText.length} characters)`);
  }

  async sendMessage() {
    const input = document.getElementById('user-message') as HTMLTextAreaElement;
    const message = input.value.trim();

    if (!message) return;

    if (!this.documentText && this.currentMode === 'upload') {
      alert('Please upload a file first or switch to "Read Current Tab" mode.');
      return;
    }

    // Add user message
    this.addMessage('user', message);
    input.value = '';

    // Disable input while processing
    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Thinking...';

    try {
      // Chat with context
      const response = await this.llm.chat(
        message,
        this.documentText.substring(0, 4000), // Limit context to 4000 chars
        (streamText) => {
          // Update AI message in real-time
          this.updateLastMessage(streamText);
        }
      );

      // Ensure final response is shown
      this.updateLastMessage(response);

    } catch (error) {
      console.error('Chat error:', error);
      this.addMessage('system', '❌ Error: ' + error);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
  }

  addMessage(role: 'user' | 'ai' | 'system', text: string) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);

    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // If AI message, mark it for streaming updates
    if (role === 'ai') {
      messageDiv.id = 'last-ai-message';
    }
  }

  updateLastMessage(text: string) {
    const lastMsg = document.getElementById('last-ai-message');
    if (lastMsg) {
      lastMsg.textContent = text;
    } else {
      // Create if doesn't exist
      this.addMessage('ai', text);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new DocumentChat();
});
```

---

### **Option 2: Chrome Extension - Automatic Tab Reading**

For Chrome extensions, you can automatically extract content from any tab.

#### **manifest.json Permissions**

```json
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

#### **Content Script (Automatic Extraction)**

```typescript
// content.ts - Automatically extracts text from any webpage
console.log('[WebLLM] Content script loaded');

// Extract text from page
function extractPageText(): string {
  // Remove script and style elements
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  
  return clone.innerText || clone.textContent || '';
}

// Send to background script
function sendPageContent() {
  const text = extractPageText();
  
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT',
    text: text,
    url: window.location.href,
    title: document.title,
  });
}

// Send on load
sendPageContent();

// Listen for requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    sendResponse({
      text: extractPageText(),
      url: window.location.href,
      title: document.title,
    });
  }
});
```

#### **Background Script (Store Content)**

```typescript
// background.ts
let currentPageContent = {
  text: '',
  url: '',
  title: '',
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_CONTENT') {
    // Store page content
    currentPageContent = {
      text: message.text,
      url: message.url,
      title: message.title,
    };
    
    console.log(`[WebLLM] Stored content from: ${message.title}`);
  }

  if (message.type === 'GET_CURRENT_PAGE') {
    sendResponse(currentPageContent);
  }

  if (message.type === 'REFRESH_CONTENT') {
    // Request fresh content from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_PAGE_CONTENT' },
          (response) => {
            if (response) {
              currentPageContent = response;
              sendResponse(response);
            }
          }
        );
      }
    });
    return true; // Async response
  }
});
```

#### **Popup with Auto-Detection**

```typescript
// popup.ts
import { WebLLMManager } from './services/WebLLMManager';

class ExtensionPopup {
  private llm: WebLLMManager;
  private pageContent: string = '';

  constructor() {
    this.llm = new WebLLMManager(true);
    this.init();
  }

  async init() {
    // Initialize LLM
    this.updateStatus('Initializing AI...');
    
    await this.llm.initialize(
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      (report) => {
        this.updateStatus(`Loading model: ${(report.progress * 100).toFixed(0)}%`);
      }
    );

    this.updateStatus('✅ Ready!');

    // Load current page content automatically
    await this.loadPageContent();

    this.setupListeners();
  }

  async loadPageContent() {
    this.updateStatus('Reading current page...');

    // Request content from background script
    chrome.runtime.sendMessage(
      { type: 'GET_CURRENT_PAGE' },
      (response) => {
        if (response && response.text) {
          this.pageContent = response.text;
          
          document.getElementById('page-title')!.textContent = response.title;
          document.getElementById('page-url')!.textContent = response.url;
          document.getElementById('content-length')!.textContent = 
            `${this.pageContent.length} characters`;
          
          this.updateStatus('✅ Page content loaded');
        } else {
          this.updateStatus('⚠️ No content found');
        }
      }
    );
  }

  setupListeners() {
    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      await this.loadPageContent();
    });

    // Send message
    document.getElementById('send-btn')?.addEventListener('click', () => {
      this.sendMessage();
    });
  }

  async sendMessage() {
    const input = document.getElementById('user-input') as HTMLTextAreaElement;
    const message = input.value.trim();

    if (!message) return;

    this.addMessage('user', message);
    input.value = '';

    try {
      const response = await this.llm.chat(
        message,
        this.pageContent.substring(0, 4000), // Limit context
        (text) => this.updateAIMessage(text)
      );

      this.updateAIMessage(response);

    } catch (error) {
      this.addMessage('error', 'Error: ' + error);
    }
  }

  updateStatus(text: string) {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
  }

  addMessage(role: string, text: string) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    messages?.appendChild(div);
    
    if (role === 'ai') {
      div.id = 'last-ai-msg';
    }
  }

  updateAIMessage(text: string) {
    const lastMsg = document.getElementById('last-ai-msg');
    if (lastMsg) {
      lastMsg.textContent = text;
    } else {
      this.addMessage('ai', text);
    }
  }
}

// Start popup
document.addEventListener('DOMContentLoaded', () => {
  new ExtensionPopup();
});
```

---

### **Option 3: Hybrid Approach (Best UX)**

Combine both methods for maximum flexibility:

```typescript
class HybridDocumentChat {
  private llm: WebLLMManager;
  private documentText: string = '';
  private source: 'upload' | 'tab' | 'none' = 'none';

  async init() {
    // Initialize LLM
    await this.llm.initialize("Llama-3.2-3B-Instruct-q4f32_1-MLC");

    // Auto-detect: Try to read current tab first
    await this.tryAutoReadTab();

    // If no content, prompt for file upload
    if (!this.documentText) {
      this.showUploadPrompt();
    }
  }

  async tryAutoReadTab() {
    try {
      // For extensions
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => document.body.innerText,
        });
        this.documentText = results[0].result;
        this.source = 'tab';
      } else {
        // For web apps (same origin)
        this.documentText = document.body.innerText;
        this.source = 'tab';
      }

      if (this.documentText) {
        this.showMessage(`✅ Auto-loaded content from current tab`);
      }
    } catch (error) {
      console.log('Could not auto-read tab:', error);
      // Fall back to upload
    }
  }

  showUploadPrompt() {
    // Show UI: "No content found. Upload a file?"
    document.getElementById('upload-prompt')!.style.display = 'block';
  }

  async handleFileUpload(file: File) {
    // Process file...
    this.documentText = await this.processFile(file);
    this.source = 'upload';
    this.showMessage(`✅ Loaded: ${file.name}`);
  }

  async chat(message: string): Promise<string> {
    // Use whichever source has content
    return await this.llm.chat(message, this.documentText);
  }
}
```

---

### **Supported File Types**

#### **Easy to Implement:**
- ✅ **TXT** - Plain text (native support)
- ✅ **Markdown (.md)** - Plain text (native support)
- ✅ **PDF** - Use `pdfjs-dist` library

#### **Medium Complexity:**
- ⚠️ **DOCX** - Use `mammoth.js` or `docx-parser`
- ⚠️ **HTML** - Parse with DOMParser
- ⚠️ **JSON** - Native JSON.parse

#### **Example: DOCX Support**

```bash
npm install mammoth
```

```typescript
import mammoth from 'mammoth';

async function readDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
```

---

### **Complete Integration Example**

```typescript
// Complete solution with all file types
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

class UniversalDocumentReader {
  async readFile(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'txt':
      case 'md':
        return await this.readText(file);
      
      case 'pdf':
        return await this.readPDF(file);
      
      case 'docx':
        return await this.readDOCX(file);
      
      case 'html':
        return await this.readHTML(file);
      
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private async readText(file: File): Promise<string> {
    return await file.text();
  }

  private async readPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    return fullText;
  }

  private async readDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async readHTML(file: File): Promise<string> {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    return doc.body.textContent || '';
  }
}

// Usage
const reader = new UniversalDocumentReader();
const text = await reader.readFile(file);
const response = await llm.chat("Summarize this", text);
```

---

### **Best Practices**

1. **Give users both options** - Upload + Tab reading
2. **Auto-detect when possible** - Try tab reading first
3. **Show file info** - Display filename, size, character count
4. **Limit context size** - Truncate to 4000-8000 characters for best performance
5. **Handle errors gracefully** - Show clear error messages
6. **Add loading indicators** - File processing can take time
7. **Support drag & drop** - Better UX than file picker alone

---

### **Permission Requirements**

#### **For Web Apps:**
- ✅ No special permissions (same-origin only)
- ✅ File uploads work anywhere

#### **For Chrome Extensions:**
```json
{
  "permissions": [
    "activeTab",      // Read current tab
    "scripting",      // Inject content scripts
    "tabs"           // Query tabs
  ],
  "host_permissions": [
    "<all_urls>"     // Access any website
  ]
}
```

---

### **Quick Implementation Checklist**

- [ ] Add file input to UI
- [ ] Implement file type detection
- [ ] Add PDF.js for PDF support
- [ ] Add tab reading functionality (extensions)
- [ ] Show content preview
- [ ] Add refresh button
- [ ] Limit context size (4000 chars recommended)
- [ ] Add loading states
- [ ] Handle errors gracefully
- [ ] Test with different file types

---

## ⚠️ Important Limitations

- ⚠️ Requires WebGPU (only Chrome/Edge 113+)
- ⚠️ Needs decent GPU (integrated GPU = slow)
- ⚠️ Large initial download (~1.7GB)
- ⚠️ Responses not instant (10 sec to 3 min)
- ⚠️ Not suitable for mobile (yet)

---

## ✨ Summary

**To add local AI chat to your project:**

1. Install: `npm install @mlc-ai/web-llm`
2. Copy the `WebLLMManager` class
3. Initialize once: `await llm.initialize()`
4. Chat: `await llm.chat(message, context)`

**That's it!** The AI runs entirely in the browser, no backend needed.

---

**Happy Coding! 🚀**

