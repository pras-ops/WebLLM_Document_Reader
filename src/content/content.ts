import { PageTextMessage } from '../shared/types';

class ContentScript {
  private isProcessing = false;

  constructor() {
    this.initializeContentScript();
  }

  private async initializeContentScript(): Promise<void> {
    console.log('Content script initialized on:', window.location.href);
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.extractPageText());
    } else {
      await this.extractPageText();
    }

    // Also handle SPA navigation
    this.setupSPAObserver();
  }

  private async extractPageText(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      // Check if this is a PDF document
      if (this.isPDFDocument()) {
        await this.handlePDFDocument();
        return;
      }

      // Extract text from regular HTML page
      const pageText = this.extractTextFromPage();
      
      if (pageText && pageText.length > 100) { // Minimum content threshold
        await this.sendPageText(pageText);
      } else {
        console.log('Page has insufficient content to extract');
      }
    } catch (error) {
      console.error('Error extracting page text:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private isPDFDocument(): boolean {
    return document.contentType === 'application/pdf' || 
           window.location.href.toLowerCase().endsWith('.pdf');
  }

  private async handlePDFDocument(): Promise<void> {
    // For PDFs, we'll handle them in the offscreen document (Phase 2)
    // Just send the URL for processing
    console.log('PDF detected - will be handled in Phase 2');
    await this.sendPageText('', true);
  }

  private extractTextFromPage(): string {
    // Basic text extraction - will be enhanced in later sprints
    const bodyText = document.body.innerText || '';
    
    // Clean up the text
    return this.cleanExtractedText(bodyText);
  }

  private cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/\n+/g, '\n')          // Replace multiple newlines with single newline
      .trim()
      .substring(0, 50000);           // Limit text length for initial version
  }

  private async sendPageText(text: string, isPDF: boolean = false): Promise<void> {
    const message: PageTextMessage = {
      type: 'PAGE_TEXT_EXTRACTED',
      payload: {
        url: window.location.href,
        title: document.title,
        text: text,
        isPDF: isPDF,
        timestamp: Date.now()
      }
    };

    try {
      await chrome.runtime.sendMessage(message);
      console.log('Page text sent to background script');
    } catch (error) {
      console.error('Failed to send page text:', error);
    }
  }

  private setupSPAObserver(): void {
    // Observe DOM changes for Single Page Applications
    const observer = new MutationObserver((mutations) => {
      let shouldExtract = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // If significant content was added, re-extract
              if (element.querySelector && 
                  (element.querySelector('main') || 
                   element.querySelector('.content') || 
                   element.querySelector('#content'))) {
                shouldExtract = true;
                break;
              }
            }
          }
        }
        if (shouldExtract) break;
      }

      if (shouldExtract) {
        // Debounce extraction
        clearTimeout((window as any).extractionTimeout);
        (window as any).extractionTimeout = setTimeout(() => {
          this.extractPageText();
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize content script
new ContentScript();

