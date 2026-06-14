import DOMPurify from 'dompurify';
import { ExtensionMessage, Message, ChatSession } from '../shared/types';

class SidepanelApp {
  private port!: chrome.runtime.Port;
  
  // DOM Elements
  private dropzone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private chooseFileBtn!: HTMLButtonElement;
  private parsingState!: HTMLElement;
  private parsingStatusTitle!: HTMLElement;
  private parsingStatusText!: HTMLElement;
  private parsingProgressBar!: HTMLElement;
  private chatWorkspace!: HTMLElement;
  private chatMessages!: HTMLElement;
  private chatInput!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private engineBadge!: HTMLElement;
  private settingsBtn!: HTMLButtonElement;
  private settingsOverlay!: HTMLElement;
  private closeSettingsBtn!: HTMLButtonElement;
  private engineSelect!: HTMLSelectElement;
  private docMenuBtn!: HTMLButtonElement;
  private docOverlay!: HTMLElement;
  private closeDocsBtn!: HTMLButtonElement;
  private docList!: HTMLElement;
  private newDocBtn!: HTMLButtonElement;
  private citationsDrawer!: HTMLElement;

  private currentDocTitle: string | null = null;
  private activeTier: 'builtin' | 'webgpu' | 'wasm' = 'wasm';
  private streamingBubble: HTMLElement | null = null;
  private accumulatedStreamingText = '';
  private currentCitations: any[] = [];
  private activeHistory: Message[] = [];

  constructor() {
    this.initializeElements();
    this.initializeEventListeners();
    this.connectPort();
    this.loadSettings();
    this.refreshDocumentList();
  }

  private initializeElements(): void {
    this.dropzone = document.getElementById('dropzone')!;
    this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
    this.chooseFileBtn = document.getElementById('chooseFileBtn') as HTMLButtonElement;
    this.parsingState = document.getElementById('parsingState')!;
    this.parsingStatusTitle = document.getElementById('parsingStatusTitle')!;
    this.parsingStatusText = document.getElementById('parsingStatusText')!;
    this.parsingProgressBar = document.getElementById('parsingProgressBar')!;
    this.chatWorkspace = document.getElementById('chatWorkspace')!;
    this.chatMessages = document.getElementById('chatMessages')!;
    this.chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
    this.engineBadge = document.getElementById('engineBadge')!;
    this.settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    this.settingsOverlay = document.getElementById('settingsOverlay')!;
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn') as HTMLButtonElement;
    this.engineSelect = document.getElementById('engineSelect') as HTMLSelectElement;
    this.docMenuBtn = document.getElementById('docMenuBtn') as HTMLButtonElement;
    this.docOverlay = document.getElementById('docOverlay')!;
    this.closeDocsBtn = document.getElementById('closeDocsBtn') as HTMLButtonElement;
    this.docList = document.getElementById('docList')!;
    this.newDocBtn = document.getElementById('newDocBtn') as HTMLButtonElement;
    this.citationsDrawer = document.getElementById('citationsDrawer')!;
  }

  private initializeEventListeners(): void {
    // Settings Overlay
    this.settingsBtn.addEventListener('click', () => this.toggleOverlay(this.settingsOverlay, true));
    this.closeSettingsBtn.addEventListener('click', () => this.toggleOverlay(this.settingsOverlay, false));
    this.engineSelect.addEventListener('change', () => this.saveSettings());

    // Documents Overlay
    this.docMenuBtn.addEventListener('click', () => {
      this.refreshDocumentList();
      this.toggleOverlay(this.docOverlay, true);
    });
    this.closeDocsBtn.addEventListener('click', () => this.toggleOverlay(this.docOverlay, false));
    this.newDocBtn.addEventListener('click', () => {
      this.toggleOverlay(this.docOverlay, false);
      this.showUploadView();
    });

    // File selection / drag & drop
    this.chooseFileBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
    
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
    });
    this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('dragover'));
    this.dropzone.addEventListener('drop', (e) => this.handleFileDrop(e));

    // Chat Inputs
    this.sendBtn.addEventListener('click', () => this.sendChatMessage());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });

    // Auto-expand input text area
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 80)}px`;
    });
  }

  private connectPort(): void {
    this.port = chrome.runtime.connect({ name: 'sidepanel' });
    
    this.port.onMessage.addListener((message: ExtensionMessage) => {
      this.handlePortMessage(message);
    });

    // Wire capability probe on startup
    this.port.postMessage({ type: 'PROBE_CAPABILITIES' });

    this.port.onDisconnect.addListener(() => {
      console.log('Port disconnected. Attempting to reconnect...');
      this.updateEngineBadgeStatus('Connecting...', 'loading');
      setTimeout(() => this.connectPort(), 1000);
    });
  }

  private toggleOverlay(overlay: HTMLElement, show: boolean): void {
    if (show) {
      overlay.classList.add('open');
    } else {
      overlay.classList.remove('open');
    }
  }

  private async loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get(['preferredEngine']);
    if (result.preferredEngine) {
      this.engineSelect.value = result.preferredEngine;
    }
    this.activeTier = this.engineSelect.value as any;
    this.updateEngineBadge();
  }

  private async saveSettings(): Promise<void> {
    this.activeTier = this.engineSelect.value as any;
    this.updateEngineBadge();

    await chrome.storage.local.set({
      preferredEngine: this.activeTier
    });
  }

  private updateEngineBadge(): void {
    let text = 'Engine: CPU (WASM)';
    if (this.activeTier === 'builtin') text = 'Engine: Chrome Built-in';
    else if (this.activeTier === 'webgpu') text = 'Engine: GPU (WebGPU)';
    this.engineBadge.textContent = text;
  }

  private updateEngineBadgeStatus(text: string, state: 'ready' | 'loading' | 'error'): void {
    this.engineBadge.textContent = text;
    this.engineBadge.className = `status-badge ${state}`;
  }

  private handleFileSelection(e: Event): void {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      this.uploadFile(files[0]);
    }
  }

  private handleFileDrop(e: DragEvent): void {
    e.preventDefault();
    this.dropzone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFile(files[0]);
    }
  }

  private uploadFile(file: File): void {
    this.showParsingView(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      this.port.postMessage({
        type: 'INGEST_FILE',
        payload: {
          filename: file.name,
          arrayBuffer
        }
      });
    };
    reader.onerror = (err) => {
      console.error('File read error:', err);
      this.showErrorView('Failed to read the file.');
    };
    reader.readAsArrayBuffer(file);
  }

  private async handlePortMessage(message: ExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'PROBE_CAPABILITIES_REPLY': {
        const { capabilities } = message.payload;
        // Verify compatibility & disable options
        const options = this.engineSelect.querySelectorAll('option');
        options.forEach((opt) => {
          const val = opt.value;
          if (!capabilities.includes(val)) {
            opt.disabled = true;
            if (!opt.textContent?.includes('Not Supported')) {
              opt.textContent += ' (Not Supported)';
            }
          }
        });

        // Auto-select best available tier if not already set in local storage
        const result = await chrome.storage.local.get(['preferredEngine']);
        if (!result.preferredEngine) {
          let autoPicked: 'builtin' | 'webgpu' | 'wasm' = 'wasm';
          if (capabilities.includes('builtin')) {
            autoPicked = 'builtin';
          } else if (capabilities.includes('webgpu')) {
            autoPicked = 'webgpu';
          }
          this.engineSelect.value = autoPicked;
          this.activeTier = autoPicked;
          this.updateEngineBadge();
          await chrome.storage.local.set({ preferredEngine: autoPicked });
        }
        break;
      }

      case 'ENGINE_FALLBACK': {
        const { originalTier, activeTier } = message.payload;
        console.warn(`Engine fallback triggered: requested ${originalTier}, active is ${activeTier}`);
        this.activeTier = activeTier;
        this.engineSelect.value = activeTier;
        this.updateEngineBadge();
        await chrome.storage.local.set({ preferredEngine: activeTier });
        break;
      }

      case 'INGEST_PROGRESS': {
        const { message: progressMsg } = message.payload;
        this.parsingStatusText.textContent = progressMsg;
        // Increment progress bar sequentially
        let currentWidth = parseFloat(this.parsingProgressBar.style.width || '0');
        if (currentWidth < 90) {
          this.parsingProgressBar.style.width = `${currentWidth + 10}%`;
        }
        break;
      }

      case 'INGEST_COMPLETE': {
        const { title } = message.payload;
        this.currentDocTitle = title;
        this.activeHistory = [
          {
            role: 'assistant',
            content: `👋 I have parsed and indexed **${title}** locally. Ask me anything about its contents!`,
            timestamp: Date.now()
          }
        ];
        this.refreshDocumentList();
        this.showChatView();
        this.clearChatMessages();
        this.displayMessage('assistant', this.activeHistory[0].content);
        this.saveChatHistory();
        break;
      }

      case 'INIT_PROGRESS': {
        const { status, progress } = message.payload;
        this.updateEngineBadgeStatus(`Loading: ${Math.round(progress * 100)}%`, 'loading');
        if (this.streamingBubble) {
          this.streamingBubble.textContent = `[Model Load: ${status}]`;
        }
        break;
      }

      case 'CHAT_CHUNK': {
        const { text } = message.payload;
        this.updateEngineBadgeStatus('Inference Active', 'loading');
        this.appendStreamingChunk(text);
        break;
      }

      case 'CHAT_REPLY': {
        if (message.error) {
          this.displayMessage('assistant', `❌ Error: ${message.error}`);
          this.enableChatInput();
          this.updateEngineBadge();
          return;
        }

        const { text, citations } = message.payload;
        this.currentCitations = citations || [];
        this.finalizeStreamingReply(text, this.currentCitations);
        this.activeHistory.push({
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          citations: this.currentCitations
        });
        this.enableChatInput();
        this.updateEngineBadge();
        this.saveChatHistory();
        break;
      }

      case 'LIST_DOCUMENTS_REPLY': {
        const { documents } = message.payload;
        this.renderDocumentsList(documents);
        break;
      }

      case 'DELETE_DOCUMENT_REPLY': {
        this.refreshDocumentList();
        if (this.currentDocTitle && !this.docListExists(this.currentDocTitle)) {
          this.showUploadView();
        }
        break;
      }

      default:
        if (message.type.endsWith('_REPLY') && message.error) {
          this.showErrorView(message.error);
        }
    }
  }

  private docListExists(title: string): boolean {
    const items = this.docList.querySelectorAll('.doc-item-title');
    for (const item of items) {
      if (item.textContent === title) return true;
    }
    return false;
  }

  private showUploadView(): void {
    this.dropzone.style.display = 'flex';
    this.parsingState.style.display = 'none';
    this.chatWorkspace.style.display = 'none';
    this.currentDocTitle = null;
    this.fileInput.value = '';
  }

  private showParsingView(title: string): void {
    this.dropzone.style.display = 'none';
    this.parsingState.style.display = 'flex';
    this.chatWorkspace.style.display = 'none';
    this.parsingStatusTitle.textContent = `Analyzing ${title}`;
    this.parsingStatusText.textContent = 'Reading raw file bytes...';
    this.parsingProgressBar.style.width = '0%';
  }

  private showChatView(): void {
    this.dropzone.style.display = 'none';
    this.parsingState.style.display = 'none';
    this.chatWorkspace.style.display = 'flex';
  }

  private showErrorView(err: string): void {
    this.dropzone.style.display = 'flex';
    this.parsingState.style.display = 'none';
    this.chatWorkspace.style.display = 'none';
    alert(`Failed to parse file: ${err}`);
  }

  private refreshDocumentList(): void {
    this.port.postMessage({ type: 'LIST_DOCUMENTS' });
  }

  private renderDocumentsList(documents: string[]): void {
    this.docList.innerHTML = '';
    if (documents.length === 0) {
      this.docList.innerHTML = '<li style="color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 20px;">No documents cached yet.</li>';
      return;
    }

    documents.forEach((title) => {
      const li = document.createElement('li');
      li.className = `doc-item ${this.currentDocTitle === title ? 'active' : ''}`;
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'doc-item-title';
      titleSpan.textContent = title;
      titleSpan.addEventListener('click', () => this.selectActiveDocument(title));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'doc-item-delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete parsed cache for "${title}"?`)) {
          this.port.postMessage({
            type: 'DELETE_DOCUMENT',
            payload: { title }
          });
        }
      });

      li.appendChild(titleSpan);
      li.appendChild(deleteBtn);
      this.docList.appendChild(li);
    });
  }

  private async selectActiveDocument(title: string): Promise<void> {
    this.currentDocTitle = title;
    this.toggleOverlay(this.docOverlay, false);
    this.showChatView();
    this.clearChatMessages();
    
    // Load historical messages if stored
    const result = await chrome.storage.local.get([`history_${title}`]);
    this.activeHistory = result[`history_${title}`] || [];
    
    if (this.activeHistory.length > 0) {
      this.activeHistory.forEach((msg) => {
        this.displayMessage(msg.role, msg.content, msg.citations);
      });
    } else {
      this.activeHistory = [
        {
          role: 'assistant',
          content: `👋 You switched to **${title}**. Ask me any question about its contents!`,
          timestamp: Date.now()
        }
      ];
      this.displayMessage('assistant', this.activeHistory[0].content);
      await this.saveChatHistory();
    }
  }

  private async saveChatHistory(): Promise<void> {
    if (!this.currentDocTitle) return;
    await chrome.storage.local.set({
      [`history_${this.currentDocTitle}`]: this.activeHistory
    });
  }

  private clearChatMessages(): void {
    this.chatMessages.innerHTML = '';
    this.citationsDrawer.style.display = 'none';
  }

  private displayMessage(role: 'user' | 'assistant', content: string, citations?: any[]): void {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerHTML = this.renderMarkdown(content);
    
    this.chatMessages.appendChild(msgDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // Attach citation clicks
    msgDiv.querySelectorAll('.citation-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10) - 1;
        if (citations && citations[idx]) {
          this.showCitationSnippet(citations[idx]);
        }
      });
    });
  }

  private showCitationSnippet(citation: any): void {
    this.citationsDrawer.style.display = 'block';
    let sourceDesc = 'Snippet';
    if (citation.pageNumber) sourceDesc = `Page ${citation.pageNumber}`;
    if (citation.sheetName) sourceDesc = `Sheet ${citation.sheetName}`;
    
    // Safely escape source description to prevent XSS
    const escapedSourceDesc = sourceDesc
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    this.citationsDrawer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <strong style="font-size:12px; color:var(--text);">Citation Source: ${escapedSourceDesc}</strong>
        <button id="closeCitationBtn" style="border:none; background:transparent; cursor:pointer; font-size:12px; color:var(--text-muted);">✕</button>
      </div>
      <div class="citation-block">${DOMPurify.sanitize(citation.text)}</div>
    `;

    document.getElementById('closeCitationBtn')?.addEventListener('click', () => {
      this.citationsDrawer.style.display = 'none';
    });
  }

  private appendStreamingChunk(text: string): void {
    if (!this.streamingBubble) {
      this.disableChatInput();
      this.streamingBubble = document.createElement('div');
      this.streamingBubble.className = 'message assistant';
      this.chatMessages.appendChild(this.streamingBubble);
      this.accumulatedStreamingText = '';
    }
    
    this.accumulatedStreamingText += text;
    this.streamingBubble.innerHTML = this.renderMarkdown(this.accumulatedStreamingText);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private finalizeStreamingReply(text: string, citations: any[]): void {
    if (this.streamingBubble) {
      this.streamingBubble.innerHTML = this.renderMarkdown(text);
      
      // Hook up citations inside the newly streamed bubble
      this.streamingBubble.querySelectorAll('.citation-link').forEach((el) => {
        el.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10) - 1;
          if (citations && citations[idx]) {
            this.showCitationSnippet(citations[idx]);
          }
        });
      });

      this.streamingBubble = null;
    }
  }

  private sendChatMessage(): void {
    const text = this.chatInput.value.trim();
    if (!text || !this.currentDocTitle) return;

    this.displayMessage('user', text);
    this.activeHistory.push({
      role: 'user',
      content: text,
      timestamp: Date.now()
    });
    this.saveChatHistory();

    this.chatInput.value = '';
    this.chatInput.style.height = '20px';
    
    this.disableChatInput();
    this.showTypingIndicator();

    this.port.postMessage({
      type: 'CHAT_MESSAGE',
      payload: {
        documentTitle: this.currentDocTitle,
        message: text,
        engineTier: this.activeTier
      }
    });
  }

  private showTypingIndicator(): void {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-dots message assistant';
    typingIndicator.id = 'typingIndicator';
    typingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    this.chatMessages.appendChild(typingIndicator);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private hideTypingIndicator(): void {
    document.getElementById('typingIndicator')?.remove();
  }

  private disableChatInput(): void {
    this.chatInput.disabled = true;
    this.sendBtn.disabled = true;
    this.hideTypingIndicator();
  }

  private enableChatInput(): void {
    this.chatInput.disabled = false;
    this.sendBtn.disabled = false;
    this.hideTypingIndicator();
    this.chatInput.focus();
  }

  private renderMarkdown(md: string): string {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Markdown Headers (### title)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold (**bold**)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic (*italic*)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Ordered & Unordered list items
    html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Source Citations matching [Source X] or [Source X] (Page Y)
    html = html.replace(/\[Source (\d+)\]/g, '<span class="citation-link" data-idx="$1">[Source $1]</span>');

    // Multi-line replacement
    html = html.replace(/\n/g, '<br>');

    return DOMPurify.sanitize(html);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SidepanelApp();
});
