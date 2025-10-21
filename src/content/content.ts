import { PageTextMessage } from '../shared/types';

class ContentScript {
  private isProcessing = false;

  constructor() {
    this.initializeContentScript();
    this.initializeMessageListener();
  }

  private initializeMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'REFRESH_DOCUMENT') {
        console.log('Received refresh document request');
        this.extractPageText().then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('Error refreshing document:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep message channel open
      }
    });
  }

  private async initializeContentScript(): Promise<void> {
    console.log('=== CONTENT SCRIPT INITIALIZED ===');
    console.log('URL:', window.location.href);
    console.log('Protocol:', window.location.protocol);
    console.log('Document type:', document.contentType);
    console.log('Document title:', document.title);
    console.log('Is PDF:', this.isPDFDocument());
    console.log('Is local file:', window.location.protocol === 'file:');
    console.log('=====================================');
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.extractPageText());
    } else {
      // Add a delay for PDFs to ensure they're fully loaded
      if (this.isPDFDocument()) {
        setTimeout(() => this.extractPageText(), 2000);
      } else {
        await this.extractPageText();
      }
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
    const checks = {
      contentType: document.contentType === 'application/pdf',
      urlEndsWithPdf: window.location.href.toLowerCase().endsWith('.pdf'),
      hasEmbedPdf: document.querySelector('embed[type="application/pdf"]') !== null,
      hasIframePdf: document.querySelector('iframe[src*=".pdf"]') !== null,
      urlContainsPdf: window.location.href.includes('pdf'),
      titleContainsPdf: document.title.toLowerCase().includes('pdf'),
      isFileProtocol: window.location.protocol === 'file:',
      urlContainsFile: window.location.href.includes('file://')
    };
    
    console.log('PDF Detection Checks:', checks);
    
    const isPDF = Object.values(checks).some(check => check === true);
    console.log('Final PDF detection result:', isPDF);
    
    return isPDF;
  }

  private async handlePDFDocument(): Promise<void> {
    console.log('PDF detected - extracting text...');
    console.log('PDF detection methods:');
    console.log('- Content type:', document.contentType);
    console.log('- URL ends with .pdf:', window.location.href.toLowerCase().endsWith('.pdf'));
    console.log('- PDFViewerApplication exists:', !!(window as any).PDFViewerApplication);
    console.log('- Document title:', document.title);
    console.log('- Is local file:', window.location.protocol === 'file:');
    
    // For local files, wait longer for PDF.js to initialize
    const isLocalFile = window.location.protocol === 'file:';
    const initialDelay = isLocalFile ? 3000 : 1000;
    
    console.log(`Waiting ${initialDelay}ms for PDF to load...`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    // Try multiple times with delays to allow PDF to load
    let pdfText = '';
    let attempts = 0;
    const maxAttempts = isLocalFile ? 5 : 3; // More attempts for local files
    
    while (attempts < maxAttempts && (!pdfText || pdfText.length < 50)) {
      attempts++;
      console.log(`PDF extraction attempt ${attempts}/${maxAttempts}`);
      
      try {
        pdfText = await this.extractTextFromPDF();
        console.log(`Attempt ${attempts} - Extracted PDF text length:`, pdfText.length);
        
        if (pdfText && pdfText.length > 50) {
          break;
        }
        
        // For local files, try to wait for PDF.js to load
        if (isLocalFile && attempts < maxAttempts) {
          console.log('Waiting for PDF.js to initialize...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to trigger PDF.js loading
          if ((window as any).PDFViewerApplication) {
            console.log('PDF.js is available, trying again...');
          } else {
            console.log('PDF.js not yet available, checking DOM...');
            // Check if PDF viewer elements are present
            const viewer = document.querySelector('#viewer') || document.querySelector('.pdfViewer');
            console.log('PDF viewer element found:', !!viewer);
          }
        } else if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error in attempt ${attempts}:`, error);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('Final extracted PDF text length:', pdfText.length);
    console.log('First 200 chars of PDF text:', pdfText.substring(0, 200));
    
    if (pdfText && pdfText.length > 50) {
      await this.sendPageText(pdfText, true);
      console.log(`PDF text extracted: ${pdfText.length} characters`);
    } else {
      console.log('Could not extract meaningful text from PDF after all attempts');
      console.log('Available DOM elements:', {
        bodyText: document.body.innerText?.length || 0,
        viewer: !!document.querySelector('#viewer'),
        textLayers: document.querySelectorAll('.textLayer').length,
        pdfViewerApp: !!(window as any).PDFViewerApplication
      });
      await this.sendPageText('PDF content could not be extracted after multiple attempts', true);
    }
  }

  private async extractTextFromPDF(): Promise<string> {
    // Method 1: Try to extract from PDF.js if available
    if ((window as any).PDFViewerApplication) {
      const pdfViewer = (window as any).PDFViewerApplication.pdfViewer;
      if (pdfViewer && pdfViewer.currentPageNumber) {
        const text = this.extractTextFromPDFJS();
        if (text && text.length > 50) {
          return text;
        }
      }
    }

    // Method 2: Try to extract from page content (for PDFs rendered as HTML)
    const htmlText = this.extractTextFromPDFHTML();
    if (htmlText && htmlText.length > 50) {
      return htmlText;
    }

    // Method 3: Try to extract from embedded PDF content
    const embeddedPdf = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement;
    if (embeddedPdf) {
      const text = this.extractTextFromEmbeddedPDF();
      if (text && text.length > 50) {
        return text;
      }
    }

    // Method 4: Try to extract from iframe PDF
    const pdfIframe = document.querySelector('iframe[src*=".pdf"]') as HTMLIFrameElement;
    if (pdfIframe) {
      const text = this.extractTextFromPDFIframe();
      if (text && text.length > 50) {
        return text;
      }
    }

    // Method 5: Try to extract from all text layers in the document
    return this.extractTextFromAllTextLayers();
  }

  private extractTextFromPDFJS(): string {
    try {
      const pdfViewer = (window as any).PDFViewerApplication.pdfViewer;
      const currentPage = pdfViewer.currentPageNumber;
      const pageView = pdfViewer.getPageView(currentPage - 1);
      
      if (pageView && pageView.textLayer) {
        const textDivs = pageView.textLayer.textDivs;
        let text = '';
        
        for (const textDiv of textDivs) {
          if (textDiv.textContent) {
            text += textDiv.textContent + ' ';
          }
        }
        
        return this.cleanExtractedText(text);
      }
    } catch (error) {
      console.error('Error extracting from PDF.js:', error);
    }
    
    return '';
  }

  private extractTextFromEmbeddedPDF(): string {
    try {
      // For embedded PDFs, try to extract from the parent document
      return this.extractTextFromPage();
    } catch (error) {
      console.error('Error extracting from embedded PDF:', error);
      return '';
    }
  }

  private extractTextFromPDFIframe(): string {
    try {
      // For iframe PDFs, we can't access cross-origin content
      // But we can try to extract from the iframe's title or alt text
      const iframe = document.querySelector('iframe[src*=".pdf"]') as HTMLIFrameElement;
      if (iframe) {
        return iframe.title || 'PDF content in iframe';
      }
    } catch (error) {
      console.error('Error extracting from PDF iframe:', error);
    }
    
    return '';
  }

  private extractTextFromPDFHTML(): string {
    try {
      // For local PDF files, try to access the PDF.js viewer directly
      if (window.location.protocol === 'file:') {
        const pdfText = this.extractTextFromLocalPDF();
        if (pdfText && pdfText.length > 50) {
          return pdfText;
        }
      }

      // For PDFs that are rendered as HTML (some browsers do this)
      // Try to extract text from the page content
      const bodyText = document.body.innerText || document.body.textContent || '';
      
      // Clean up common PDF artifacts
      let cleanText = bodyText
        .replace(/Page \d+ of \d+/g, '')  // Remove page numbers
        .replace(/^\d+\s*$/gm, '')        // Remove standalone numbers
        .replace(/\s+/g, ' ')             // Normalize whitespace
        .trim();
      
      return cleanText;
    } catch (error) {
      console.error('Error extracting from PDF HTML:', error);
      return '';
    }
  }

  private extractTextFromLocalPDF(): string {
    try {
      console.log('Attempting to extract text from local PDF...');
      
      // Method 1: Try to access PDF.js viewer elements
      const pdfViewer = document.querySelector('#viewer') || document.querySelector('.pdfViewer');
      if (pdfViewer) {
        console.log('Found PDF viewer element');
        const text = (pdfViewer as HTMLElement).innerText || pdfViewer.textContent || '';
        if (text && text.length > 50) {
          return this.cleanExtractedText(text);
        }
      }

      // Method 2: Try to find text layers in the PDF viewer
      const textLayers = document.querySelectorAll('.textLayer, .textlayer, [class*="textLayer"]');
      if (textLayers.length > 0) {
        console.log(`Found ${textLayers.length} text layers`);
        let allText = '';
        for (const layer of textLayers) {
          const text = layer.textContent || (layer as HTMLElement).innerText || '';
          if (text.trim()) {
            allText += text + ' ';
          }
        }
        if (allText.length > 50) {
          return this.cleanExtractedText(allText);
        }
      }

      // Method 3: Try to access PDF.js API if available
      if ((window as any).PDFViewerApplication) {
        console.log('PDF.js viewer application found');
        return this.extractTextFromPDFJSViewer();
      }

      // Method 4: Try to extract from all divs that might contain text
      const allDivs = document.querySelectorAll('div');
      let extractedText = '';
      for (const div of allDivs) {
        const text = div.textContent || (div as HTMLElement).innerText || '';
        // Look for meaningful text (more than just numbers or single characters)
        if (text.trim() && text.length > 10 && /[a-zA-Z]/.test(text)) {
          extractedText += text + ' ';
        }
      }
      
      if (extractedText.length > 50) {
        return this.cleanExtractedText(extractedText);
      }

      console.log('No text found in local PDF');
      return '';
    } catch (error) {
      console.error('Error extracting from local PDF:', error);
      return '';
    }
  }

  private extractTextFromPDFJSViewer(): string {
    try {
      const pdfViewer = (window as any).PDFViewerApplication;
      if (!pdfViewer || !pdfViewer.pdfViewer) {
        return '';
      }

      const viewer = pdfViewer.pdfViewer;
      const pages = viewer._pages || [];
      let allText = '';

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page && page.textLayer) {
          const textDivs = page.textLayer.textDivs || [];
          for (const textDiv of textDivs) {
            if (textDiv.textContent) {
              allText += textDiv.textContent + ' ';
            }
          }
        }
      }

      return this.cleanExtractedText(allText);
    } catch (error) {
      console.error('Error extracting from PDF.js viewer:', error);
      return '';
    }
  }

  private extractTextFromAllTextLayers(): string {
    try {
      let allText = '';
      
      // Try to find all text layers in the document
      const textLayers = document.querySelectorAll('.textLayer, .text-layer, [class*="text"]');
      
      for (const layer of textLayers) {
        const text = layer.textContent || (layer as HTMLElement).innerText || '';
        if (text.trim()) {
          allText += text + ' ';
        }
      }
      
      // Also try to extract from any divs that might contain text
      const textDivs = document.querySelectorAll('div[style*="position"], div[class*="page"]');
      for (const div of textDivs) {
        const text = div.textContent || (div as HTMLElement).innerText || '';
        if (text.trim() && text.length > 10) {
          allText += text + ' ';
        }
      }
      
      // If we still don't have much text, try extracting from the entire document
      if (allText.length < 100) {
        const bodyText = document.body.innerText || document.body.textContent || '';
        allText = bodyText;
      }
      
      // For local PDFs, try a more aggressive approach
      if (allText.length < 50 && window.location.protocol === 'file:') {
        allText = this.extractTextFromLocalPDFAggressive();
      }
      
      return this.cleanExtractedText(allText);
    } catch (error) {
      console.error('Error extracting from all text layers:', error);
      return '';
    }
  }

  private extractTextFromLocalPDFAggressive(): string {
    try {
      console.log('Using aggressive extraction for local PDF...');
      
      // Try to select all text on the page
      const selection = window.getSelection();
      if (selection) {
        selection.selectAllChildren(document.body);
        const selectedText = selection.toString();
        if (selectedText && selectedText.length > 50) {
          selection.removeAllRanges();
          return this.cleanExtractedText(selectedText);
        }
        selection.removeAllRanges();
      }
      
      // Try to extract from all possible elements
      const allElements = document.querySelectorAll('*');
      let extractedText = '';
      
      for (const element of allElements) {
        const text = element.textContent || (element as HTMLElement).innerText || '';
        // Look for meaningful text content
        if (text.trim() && text.length > 5 && /[a-zA-Z]{3,}/.test(text)) {
          extractedText += text + ' ';
        }
      }
      
      // Remove duplicates and clean up
      const words = extractedText.split(/\s+/);
      const uniqueWords = [...new Set(words)];
      const cleanedText = uniqueWords.join(' ');
      
      return this.cleanExtractedText(cleanedText);
    } catch (error) {
      console.error('Error in aggressive PDF extraction:', error);
      return '';
    }
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

