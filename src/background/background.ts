import { ExtensionMessage } from '../shared/types';

class BackgroundService {
  private activeSidepanelPort: chrome.runtime.Port | null = null;
  private activeOffscreenPort: chrome.runtime.Port | null = null;
  private messageQueue: any[] = [];

  constructor() {
    this.initializeLifecycleHandlers();
    this.initializePortHandlers();
  }

  private initializeLifecycleHandlers(): void {
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Extension installed/updated:', details.reason);
      // Set panel behavior so clicking action icon opens the side panel
      if (chrome.sidePanel && (chrome.sidePanel as any).setPanelBehavior) {
        (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: true })
          .then(() => console.log('Successfully set openPanelOnActionClick'))
          .catch((err: any) => console.error('Error setting panel behavior:', err));
      }
      this.initializeStorage();
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension starting up...');
      this.ensureOffscreenDocument().catch(console.error);
    });
  }

  private initializePortHandlers(): void {
    chrome.runtime.onConnect.addListener((port) => {
      console.log(`Port connected: ${port.name}`);
      
      if (port.name === 'sidepanel') {
        this.activeSidepanelPort = port;
        
        // Ensure offscreen document is running when sidepanel opens
        this.ensureOffscreenDocument().catch(console.error);

        port.onMessage.addListener((msg) => {
          if (this.activeOffscreenPort) {
            this.activeOffscreenPort.postMessage(msg);
          } else {
            console.log('Offscreen port not active, queueing message:', msg.type);
            this.messageQueue.push(msg);
          }
        });

        port.onDisconnect.addListener(() => {
          console.log('Sidepanel port disconnected');
          this.activeSidepanelPort = null;
        });
      } else if (port.name === 'offscreen') {
        this.activeOffscreenPort = port;

        // Flush queued messages
        while (this.messageQueue.length > 0 && this.activeOffscreenPort) {
          const queuedMsg = this.messageQueue.shift();
          console.log('Flushing queued message to offscreen:', queuedMsg.type);
          this.activeOffscreenPort.postMessage(queuedMsg);
        }

        port.onMessage.addListener((msg) => {
          if (this.activeSidepanelPort) {
            this.activeSidepanelPort.postMessage(msg);
          } else {
            console.warn('Sidepanel not connected to receive message:', msg.type);
          }
        });

        port.onDisconnect.addListener(() => {
          console.log('Offscreen port disconnected');
          this.activeOffscreenPort = null;
        });
      }
    });
  }

  private async ensureOffscreenDocument(): Promise<void> {
    if (await this.hasOffscreenDocument()) {
      return;
    }

    try {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html'),
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Run WebLLM/Wllama engines and process local files'
      });
      console.log('Offscreen document created successfully');
    } catch (error) {
      console.error('Failed to create offscreen document:', error);
      throw error;
    }
  }

  private async hasOffscreenDocument(): Promise<boolean> {
    try {
      const existingContexts = await (chrome.runtime as any).getContexts?.({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      return existingContexts && existingContexts.length > 0;
    } catch {
      return false;
    }
  }

  private async initializeStorage(): Promise<void> {
    const defaultState = {
      settings: {
        autoExtract: true,
        enableHistory: true
      },
      chatSessions: []
    };

    await chrome.storage.local.set(defaultState);
    console.log('Storage initialized with default state');
  }
}

new BackgroundService();
console.log('Background service worker initialized');
