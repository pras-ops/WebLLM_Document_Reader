import { ExtensionMessage, ChatMessage, ModelProgressMessage, ChatReplyMessage } from '../shared/types';

class PopupApp {
  private chatArea!: HTMLElement;
  private messageInput!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private statusElement!: HTMLElement;
  private statusText!: HTMLElement;
  
  private currentDocument: any = null;
  private isModelReady = false;
  private isWaitingForResponse = false;

  constructor() {
    this.initializeElements();
    this.initializeEventListeners();
    this.initializeApp();
  }

  private initializeElements(): void {
    this.chatArea = document.getElementById('chatArea')!;
    this.messageInput = document.getElementById('messageInput') as HTMLInputElement;
    this.sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    this.statusElement = document.getElementById('status')!;
    this.statusText = document.getElementById('statusText')!;
  }

  private initializeEventListeners(): void {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isWaitingForResponse) {
        this.sendMessage();
      }
    });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      this.handleMessage(message);
    });
  }

  private async initializeApp(): Promise<void> {
    try {
      this.updateStatus('Initializing AI model', 'loading');
      
      // Initialize offscreen document
      await chrome.runtime.sendMessage({ type: 'INIT_OFFSCREEN' });
      
      // Load saved state
      await this.loadSavedState();
      
      // Initialize the model
      await chrome.runtime.sendMessage({ type: 'INIT_MODEL' });
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Failed to initialize: ' + (error as Error).message, 'error');
    }
  }

  private async loadSavedState(): Promise<void> {
    const result = await chrome.storage.local.get(['currentDocument', 'settings']);
    
    if (result.currentDocument) {
      this.currentDocument = result.currentDocument;
      if (this.currentDocument.title) {
        this.addMessage(`📄 Document loaded: "${this.currentDocument.title}"`, 'assistant');
      }
    }
  }

  private handleMessage(message: ExtensionMessage): void {
    console.log('Popup received message:', message);
    
    switch (message.type) {
      case 'DOCUMENT_READY':
        this.loadSavedState();
        break;
        
      case 'MODEL_PROGRESS':
        this.handleModelProgress(message as ModelProgressMessage);
        break;
        
      case 'CHAT_REPLY':
        this.handleChatReply(message as ChatReplyMessage);
        break;
    }
  }

  private handleModelProgress(message: ModelProgressMessage): void {
    const progress = Math.round(message.payload.progress * 100);
    const stage = message.payload.stage;
    
    this.updateStatus(`Loading model: ${progress}% (${stage})`, 'loading');
    
    if (progress >= 100) {
      this.isModelReady = true;
      this.updateStatus('✓ Model ready!', 'ready');
      this.enableInput();
    }
  }

  private async sendMessage(): Promise<void> {
    const message = this.messageInput.value.trim();
    if (!message || this.isWaitingForResponse) return;

    if (!this.isModelReady) {
      this.addMessage('⚠️ Please wait for the model to load completely.', 'assistant');
      return;
    }

    this.addMessage(message, 'user');
    this.messageInput.value = '';
    this.disableInput();
    this.isWaitingForResponse = true;
    
    // Add typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'message assistant-message';
    typingDiv.innerHTML = 'Thinking<span class="loading-dots"></span>';
    this.chatArea.appendChild(typingDiv);
    this.chatArea.scrollTop = this.chatArea.scrollHeight;

    try {
      const chatMessage: ChatMessage = {
        type: 'CHAT_MESSAGE',
        payload: {
          message: message,
          context: this.currentDocument?.text,
          sessionId: this.generateSessionId()
        }
      };

      await chrome.runtime.sendMessage(chatMessage);
    } catch (error) {
      this.addMessage('❌ Error sending message: ' + (error as Error).message, 'assistant');
      this.enableInput();
      this.isWaitingForResponse = false;
      
      // Remove typing indicator
      const indicator = document.getElementById('typing-indicator');
      if (indicator) indicator.remove();
    }
  }

  private handleChatReply(message: ChatReplyMessage): void {
    // Remove typing indicator
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    if (message.error) {
      this.addMessage('❌ Error: ' + message.error, 'assistant');
    } else {
      this.addMessage(message.payload.text, 'assistant');
    }
    
    this.enableInput();
    this.isWaitingForResponse = false;
  }

  private addMessage(text: string, sender: 'user' | 'assistant'): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    
    this.chatArea.appendChild(messageDiv);
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }

  private updateStatus(text: string, type: 'loading' | 'ready' | 'error'): void {
    this.statusText.innerHTML = text;
    this.statusElement.className = `status ${type}`;
  }

  private enableInput(): void {
    this.messageInput.disabled = false;
    this.sendButton.disabled = false;
    this.messageInput.focus();
  }

  private disableInput(): void {
    this.messageInput.disabled = true;
    this.sendButton.disabled = true;
  }

  private generateSessionId(): string {
    return 'session-' + Date.now();
  }
}

// Initialize the popup app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});

