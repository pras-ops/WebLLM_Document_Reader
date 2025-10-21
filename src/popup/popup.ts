import { ExtensionMessage, ChatMessage, ModelProgressMessage, ChatReplyMessage } from '../shared/types';
import * as pdfjsLib from 'pdfjs-dist';

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
    this.initializePDFJS();
    this.initializeApp();
  }

  private initializePDFJS(): void {
    try {
      // Configure PDF.js worker for extension context
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
      console.log('PDF.js configured successfully');
    } catch (error) {
      console.error('Failed to configure PDF.js:', error);
    }
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

    // PDF upload functionality
    this.initializePDFUpload();

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      this.handleMessage(message);
    });
  }

  private initializePDFUpload(): void {
    const pdfInput = document.getElementById('pdfInput') as HTMLInputElement;
    const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
    const fileName = document.getElementById('fileName') as HTMLElement;

    if (pdfInput && uploadBtn && fileName) {
      uploadBtn.addEventListener('click', () => this.handlePDFUpload());
      pdfInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          console.log('PDF file selected:', file.name);
          fileName.textContent = `📄 ${file.name}`;
          fileName.style.display = 'block';
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload & Analyze';
        } else {
          fileName.style.display = 'none';
          uploadBtn.disabled = true;
        }
      });
    }
  }

  private async initializeApp(): Promise<void> {
    try {
      this.updateStatus('Initializing AI model', 'loading');
      
      // Initialize offscreen document
      await chrome.runtime.sendMessage({ type: 'INIT_OFFSCREEN' });
      
      // Load saved state
      await this.loadSavedState();
      
      // Try to refresh document context from current tab
      await this.refreshDocumentContext();
      
      // Initialize the model
      await chrome.runtime.sendMessage({ type: 'INIT_MODEL' });
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Failed to initialize: ' + (error as Error).message, 'error');
    }
  }

  private async refreshDocumentContext(): Promise<void> {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url) {
        console.log('Current tab URL:', tab.url);
        
        // If it's a local PDF, try to inject content script manually
        if (tab.url.startsWith('file://') && tab.url.toLowerCase().includes('.pdf')) {
          console.log('Attempting to inject content script into local PDF...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            console.log('Content script injected successfully');
            
            // Wait a bit for the content script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.log('Failed to inject content script:', error);
          }
        }
        
        // Send a message to the content script to re-extract text
        await chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_DOCUMENT' });
      }
    } catch (error) {
      console.log('Could not refresh document context:', error);
    }
  }

  private async loadSavedState(): Promise<void> {
    const result = await chrome.storage.local.get(['currentDocument', 'settings']);
    
    if (result.currentDocument) {
      this.currentDocument = result.currentDocument;
      console.log('Loaded document from storage:', this.currentDocument);
      if (this.currentDocument.title) {
        this.addMessage(`📄 Document loaded: "${this.currentDocument.title}"`, 'assistant');
        console.log('Document text length:', this.currentDocument.text?.length || 0);
      }
    } else {
      console.log('No document found in storage');
      this.addMessage('📄 No document loaded. Please navigate to a webpage or PDF to start chatting.', 'assistant');
      this.addMessage('💡 Tip: Make sure you\'re on the tab with the document you want to analyze, then refresh this popup.', 'assistant');
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
    
    // Show more detailed progress for better user experience
    if (progress < 10) {
      this.updateStatus('🔄 Initializing AI model...', 'loading');
    } else if (progress < 50) {
      this.updateStatus(`📥 Downloading model: ${progress}%`, 'loading');
    } else if (progress < 90) {
      this.updateStatus(`⚡ Loading GPU shaders: ${progress}%`, 'loading');
    } else if (progress < 100) {
      this.updateStatus(`🔧 Finalizing setup: ${progress}%`, 'loading');
    }
    
    if (progress >= 100) {
      this.isModelReady = true;
      this.updateStatus('✓ Model ready!', 'ready');
      this.enableInput();
      this.addMessage('🤖 AI model is ready! You can now ask questions about the document.', 'assistant');
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
    
    // Prevent duplicate messages by clearing the input immediately
    this.messageInput.disabled = true;
    
    // Add typing indicator
    this.showTypingIndicator();

    try {
      console.log('Sending chat message with context length:', this.currentDocument?.text?.length || 0);
      console.log('Current document:', this.currentDocument);
      
      const chatMessage: ChatMessage = {
        type: 'CHAT_MESSAGE',
        payload: {
          message: message,
          context: this.currentDocument?.text || '',
          sessionId: this.generateSessionId()
        }
      };

      console.log('Chat message payload:', chatMessage.payload);
      await chrome.runtime.sendMessage(chatMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage('❌ Error sending message: ' + (error as Error).message, 'assistant');
      this.enableInput();
      this.isWaitingForResponse = false;
      
      // Remove typing indicator
      this.hideTypingIndicator();
    }
  }

  private handleChatReply(message: ChatReplyMessage): void {
    // Remove typing indicator
    this.hideTypingIndicator();
    
    if (message.error) {
      this.addMessage('❌ Error: ' + message.error, 'assistant');
    } else {
      this.addMessage(message.payload.text, 'assistant');
    }
    
    this.enableInput();
    this.isWaitingForResponse = false;
  }

  private addMessage(text: string, sender: 'user' | 'assistant'): void {
    // Clear welcome message if it exists
    const welcomeMessage = this.chatArea.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Handle line breaks and formatting
    const formattedText = text.replace(/\n/g, '<br>');
    messageDiv.innerHTML = formattedText;
    
    this.chatArea.appendChild(messageDiv);
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }

  private showTypingIndicator(): void {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    this.chatArea.appendChild(typingDiv);
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }

  private hideTypingIndicator(): void {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
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

  private async handlePDFUpload(): Promise<void> {
    const pdfInput = document.getElementById('pdfInput') as HTMLInputElement;
    const file = pdfInput?.files?.[0];
    
    if (!file) {
      this.addMessage('❌ Please select a PDF file first.', 'assistant');
      return;
    }

    if (!file.type.includes('pdf')) {
      this.addMessage('❌ Please select a valid PDF file.', 'assistant');
      return;
    }

    try {
      // Update button to show processing
      const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Processing...';
      
      this.addMessage(`📄 Processing PDF: ${file.name}...`, 'assistant');
      
      // Extract text from PDF using PDF.js
      const extractedText = await this.extractTextFromPDF(file);
      
      if (extractedText && extractedText.length > 50) {
        // Store the extracted text as current document
        this.currentDocument = {
          url: `file://${file.name}`,
          title: file.name,
          text: extractedText,
          isPDF: true,
          timestamp: Date.now()
        };

        // Save to storage
        await chrome.storage.local.set({
          currentDocument: this.currentDocument
        });

        this.addMessage(`✅ PDF loaded successfully! Extracted ${extractedText.length.toLocaleString()} characters of text.`, 'assistant');
        this.addMessage(`📖 You can now ask questions about "${file.name}"`, 'assistant');
        
        // Clear the file input and reset button
        pdfInput.value = '';
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload & Analyze';
        
        // Hide file name
        const fileName = document.getElementById('fileName') as HTMLElement;
        fileName.style.display = 'none';
      } else {
        this.addMessage('❌ Could not extract meaningful text from the PDF. The PDF might be image-based or corrupted.', 'assistant');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload & Analyze';
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      this.addMessage(`❌ Error processing PDF: ${(error as Error).message}`, 'assistant');
      
      // Reset button on error
      const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Analyze';
    }
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          console.log('FileReader loaded, extracting PDF text...');
          
          console.log('Reading file as ArrayBuffer...');
          const typedArray = new Uint8Array(this.result as ArrayBuffer);
          console.log('ArrayBuffer size:', typedArray.length);
          
          // Load the PDF document using imported PDF.js
          console.log('Loading PDF document...');
          const loadingTask = pdfjsLib.getDocument({
            data: typedArray,
            verbosity: 0 // Reduce console output
          });
          
          const pdf = await loadingTask.promise;
          console.log('PDF loaded successfully:', pdf.numPages, 'pages');
          
          let fullText = '';
          
          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            console.log(`Extracting text from page ${pageNum}...`);
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Extract text items more carefully
            const pageText = textContent.items
              .filter((item: any) => item.str && item.str.trim())
              .map((item: any) => item.str.trim())
              .join(' ');
            
            fullText += `Page ${pageNum}: ${pageText}\n\n`;
            console.log(`Page ${pageNum} text length:`, pageText.length);
          }
          
          console.log('Total extracted text length:', fullText.length);
          console.log('First 200 characters:', fullText.substring(0, 200));
          
          if (fullText.trim().length < 10) {
            reject(new Error('No meaningful text found in PDF. The PDF might be image-based or corrupted.'));
            return;
          }
          
          resolve(fullText);
        } catch (error) {
          console.error('PDF extraction error:', error);
          reject(error);
        }
      };
      
      fileReader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Failed to read file'));
      };
      
      console.log('Starting to read file as ArrayBuffer...');
      fileReader.readAsArrayBuffer(file);
    });
  }
}

// Initialize the popup app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});

