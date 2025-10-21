import { ExtensionMessage, PageTextMessage, ChatMessage } from '../shared/types';

class BackgroundService {
  private offscreenDocument: any = null;

  constructor() {
    this.initializeMessageHandlers();
    this.initializeLifecycleHandlers();
  }

  private initializeMessageHandlers(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse).catch(console.error);
        return true; // Keep message channel open for async response
      }
    );
  }

  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'PAGE_TEXT_EXTRACTED':
          await this.handlePageText(message as PageTextMessage);
          sendResponse({ success: true });
          break;
          
        case 'CHAT_MESSAGE':
          await this.handleChatMessage(message as ChatMessage, sendResponse);
          break;
          
        case 'INIT_OFFSCREEN':
          await this.ensureOffscreenDocument();
          sendResponse({ success: true });
          break;
          
        case 'INIT_MODEL':
          // Forward to offscreen document
          await this.ensureOffscreenDocument();
          sendResponse({ success: true });
          break;
          
        case 'MODEL_PROGRESS':
        case 'CHAT_REPLY':
        case 'DOCUMENT_READY':
          // These are broadcast messages, just acknowledge
          sendResponse({ success: true });
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: (error as Error).message });
    }
  }

  private async ensureOffscreenDocument(): Promise<void> {
    if (await this.hasOffscreenDocument()) {
      return;
    }

    this.offscreenDocument = {
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Run WebLLM model and process documents'
    };

    try {
      await chrome.offscreen.createDocument(this.offscreenDocument);
      console.log('Offscreen document created successfully');
    } catch (error) {
      console.error('Failed to create offscreen document:', error);
      throw error;
    }
  }

  private async hasOffscreenDocument(): Promise<boolean> {
    // Check if offscreen document exists using try/catch approach
    try {
      const existingContexts = await (chrome.runtime as any).getContexts?.({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      return existingContexts && existingContexts.length > 0;
    } catch {
      return false;
    }
  }

  private async handlePageText(message: PageTextMessage): Promise<void> {
    // Store document context for later use
    await chrome.storage.local.set({
      currentDocument: message.payload
    });
    
    console.log('Stored document:', message.payload.title);
    
    // Notify popup that we have document content
    await this.sendToPopup({
      type: 'DOCUMENT_READY',
      payload: { title: message.payload.title }
    });
  }

  private async handleChatMessage(message: ChatMessage, sendResponse: (response?: any) => void): Promise<void> {
    await this.ensureOffscreenDocument();
    
    // Forward chat message to offscreen document
    try {
      const response = await chrome.runtime.sendMessage(message);
      
      // If we got a chat reply, broadcast it to the popup
      if (response && response.type === 'CHAT_REPLY') {
        await this.sendToPopup(response);
      }
      
      sendResponse(response);
    } catch (error) {
      console.error('Error forwarding chat message:', error);
      sendResponse({ error: (error as Error).message });
    }
  }

  private async sendToPopup(message: ExtensionMessage): Promise<void> {
    // This will be handled by popup when it's open
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup is not open, which is fine
    });
  }

  private initializeLifecycleHandlers(): void {
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension starting up...');
    });

    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Extension installed/updated:', details.reason);
      this.initializeStorage();
    });

    // Listen for tab updates to inject content script into local PDFs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  private async handleTabUpdate(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url) return;
    
    // Check if this is a local PDF file
    if (tab.url.startsWith('file://') && tab.url.toLowerCase().includes('.pdf')) {
      console.log('Detected local PDF:', tab.url);
      
      try {
        // Try to inject content script manually
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        console.log('Content script injected into local PDF');
      } catch (error) {
        console.log('Could not inject content script:', error);
        // This is expected if the extension doesn't have permission yet
      }
    }
  }

  private async initializeStorage(): Promise<void> {
    const defaultState = {
      settings: {
        modelSize: '3B',
        autoExtract: true,
        enableHistory: true
      },
      chatSessions: [],
      currentModel: 'Llama-3.2-3B-Instruct-q4f32_1-MLC'
    };

    await chrome.storage.local.set(defaultState);
    console.log('Storage initialized with default state');
  }
}

// Initialize the background service
new BackgroundService();
console.log('Background service worker initialized');

