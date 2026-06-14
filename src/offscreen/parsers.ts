import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import { TextChunk } from '../shared/types';

// Configure PDFJS worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

export interface ParsedDocument {
  title: string;
  text: string;
  pages?: Array<{ text: string; pageNumber: number }>;
  sheets?: Array<{ text: string; sheetName: string }>;
  slides?: Array<{ text: string; slideNumber: number }>;
  isPDF?: boolean;
}

export class ParserRegistry {
  /**
   * Parse a file based on its name/extension and raw bytes (ArrayBuffer)
   */
  static async parseFile(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Check common unsupported binary formats to fail fast with friendly error
    const unsupportedBinaryExts = new Set([
      'doc', 'ppt', 'rtf', 'odt', 'odp', 'ods',
      'zip', 'rar', 'tar', 'gz', '7z', 'exe', 'dll', 'so', 'dylib', 'bin', 'dmg', 'pkg', 'iso',
      'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'webm', 'm4a', 'wma', 'aac',
      'heic', 'gif', 'tiff', 'bmp'
    ]);
    if (ext && unsupportedBinaryExts.has(ext)) {
      throw new Error(`The file format ".${ext}" is not supported. Please convert it to a supported format (PDF, DOCX, XLSX, PPTX, EPUB, TXT, or Image).`);
    }
    
    switch (ext) {
      case 'pdf':
        return this.parsePDF(filename, arrayBuffer, onProgress);
      case 'docx':
        return this.parseDOCX(filename, arrayBuffer, onProgress);
      case 'xlsx':
      case 'xls':
      case 'csv':
        return this.parseXLSX(filename, arrayBuffer, onProgress);
      case 'pptx':
        return this.parsePPTX(filename, arrayBuffer, onProgress);
      case 'epub':
        return this.parseEPUB(filename, arrayBuffer, onProgress);
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return this.parseImage(filename, arrayBuffer, onProgress);
      default:
        // Plain text fallback (txt, md, json, js, ts, html, etc.)
        if (this.isBinaryBuffer(arrayBuffer)) {
          throw new Error(`The file format ".${ext || 'unknown'}" is a binary file and is not supported. Please upload a supported document (PDF, DOCX, XLSX, PPTX, EPUB, TXT, or Image).`);
        }
        return this.parseText(filename, arrayBuffer);
    }
  }

  private static isBinaryBuffer(buffer: ArrayBuffer): boolean {
    const bytes = new Uint8Array(buffer.slice(0, 1024));
    if (bytes.length === 0) return false;
    let controlChars = 0;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      // ASCII control characters (excluding tab 9, newline 10, carriage return 13)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlChars++;
        if (byte === 0) return true; // Null byte indicates binary
      }
    }
    return controlChars / bytes.length > 0.10;
  }

  private static async parseText(filename: string, arrayBuffer: ArrayBuffer): Promise<ParsedDocument> {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer);
    return {
      title: filename,
      text: text,
      pages: [{ text, pageNumber: 1 }]
    };
  }

  private static async parsePDF(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      verbosity: 0
    });
    
    const pdf = await loadingTask.promise;
    const pages: Array<{ text: string; pageNumber: number }> = [];
    let fullText = '';
    let hasTextContent = false;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.(`Extracting text from page ${pageNum} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => item.str.trim())
        .join(' ');
      
      if (pageText.length > 5) {
        hasTextContent = true;
      }
      
      pages.push({ text: pageText, pageNumber: pageNum });
      fullText += `[Page ${pageNum}]\n${pageText}\n\n`;
    }

    // OCR Fallback: If no meaningful text content was extracted (e.g. scanned PDF), run OCR page by page
    if (!hasTextContent && pdf.numPages > 0) {
      onProgress?.('No embedded text found. Running OCR fallback (Tesseract.js)...');
      fullText = '';
      pages.length = 0;
      
      const worker = await createWorker('eng');
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        onProgress?.(`Performing OCR on page ${pageNum} of ${pdf.numPages}...`);
        const page = await pdf.getPage(pageNum);
        
        // Render PDF page to a canvas
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (context) {
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          const ret = await worker.recognize(canvas);
          const pageText = ret.data.text;
          pages.push({ text: pageText, pageNumber: pageNum });
          fullText += `[Page ${pageNum} - OCR]\n${pageText}\n\n`;
        }
      }
      
      await worker.terminate();
    }

    return {
      title: filename,
      text: fullText,
      pages: pages,
      isPDF: true
    };
  }

  private static async parseDOCX(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Extracting DOCX content...');
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value || '';
    return {
      title: filename,
      text: text,
      pages: [{ text, pageNumber: 1 }]
    };
  }

  private static async parseXLSX(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Reading Excel sheets...');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheets: Array<{ text: string; sheetName: string }> = [];
    let fullText = '';

    workbook.SheetNames.forEach((sheetName) => {
      onProgress?.(`Parsing sheet: ${sheetName}...`);
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      sheets.push({ text: csv, sheetName });
      fullText += `[Sheet: ${sheetName}]\n${csv}\n\n`;
    });

    return {
      title: filename,
      text: fullText,
      sheets
    };
  }

  private static async parsePPTX(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Extracting PPTX content...');
    // A simple, pure-JS XML slide text extractor using JSZip to avoid binary dependency issues
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slides: Array<{ text: string; slideNumber: number }> = [];
    let fullText = '';

    // Find all slides in ppt/slides/slide[0-9]+.xml
    const slideFiles = Object.keys(zip.files)
      .filter((filePath) => filePath.startsWith('ppt/slides/slide') && filePath.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^\d]/g, ''), 10);
        const numB = parseInt(b.replace(/[^\d]/g, ''), 10);
        return numA - numB;
      });

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const slideNum = i + 1;
      onProgress?.(`Parsing slide ${slideNum} of ${slideFiles.length}...`);
      
      const xmlContent = await zip.files[slidePath].async('string');
      // Simple regex parser to extract text contents inside <a:t>...</a:t>
      const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
      let slideText = '';
      
      if (textMatches) {
        slideText = textMatches
          .map((match: any) => {
            const clean = match.replace(/<\/?a:t>/g, '');
            return clean.trim();
          })
          .filter((t: any) => t.length > 0)
          .join(' ');
      }

      slides.push({ text: slideText, slideNumber: slideNum });
      fullText += `[Slide ${slideNum}]\n${slideText}\n\n`;
    }

    if (fullText.length === 0) {
      fullText = 'No text content could be extracted from PPTX slides.';
    }

    return {
      title: filename,
      text: fullText,
      slides
    };
  }

  private static async parseEPUB(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Parsing EPUB container...');
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find opf file to locate chapters
    let opfPath = '';
    const containerXml = await zip.files['META-INF/container.xml']?.async('string');
    if (containerXml) {
      const fullPathMatch = containerXml.match(/full-path="([^"]+)"/);
      if (fullPathMatch) {
        opfPath = fullPathMatch[1];
      }
    }

    if (!opfPath) {
      // Look for any .opf file in the zip
      opfPath = Object.keys(zip.files).find((p) => p.endsWith('.opf')) || '';
    }

    if (!opfPath) {
      throw new Error('Invalid EPUB file structure: OPF file not found.');
    }

    const opfContent = await zip.files[opfPath].async('string');
    const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // Extract manifest items (HTML files)
    const hrefMatches = opfContent.match(/href="([^"]+\.x?html?)"/g) || [];
    const htmlFiles = hrefMatches.map((m: any) => {
      const relPath = m.substring(6, m.length - 1);
      return baseDir + relPath;
    });

    // Remove duplicates
    const uniqueHtmlFiles: string[] = [...new Set<string>(htmlFiles)];
    let fullText = '';
    const pages: Array<{ text: string; pageNumber: number }> = [];

    for (let i = 0; i < uniqueHtmlFiles.length; i++) {
      const htmlPath = uniqueHtmlFiles[i];
      onProgress?.(`Parsing EPUB section ${i + 1} of ${uniqueHtmlFiles.length}...`);
      
      const fileEntry = zip.files[htmlPath];
      if (fileEntry) {
        const html = await fileEntry.async('string');
        // Simple HTML-to-text strip
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const text = doc.body.innerText || doc.body.textContent || '';
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanText.length > 10) {
          pages.push({ text: cleanText, pageNumber: i + 1 });
          fullText += `[Section ${i + 1}]\n${cleanText}\n\n`;
        }
      }
    }

    return {
      title: filename,
      text: fullText,
      pages
    };
  }

  private static async parseImage(filename: string, arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<ParsedDocument> {
    onProgress?.('Initializing OCR engine...');
    const worker = await createWorker('eng');
    
    // Create Blob URL from ArrayBuffer to feed into Tesseract
    const blob = new Blob([arrayBuffer]);
    const blobUrl = URL.createObjectURL(blob);
    
    onProgress?.('Running text recognition on image...');
    const ret = await worker.recognize(blobUrl);
    const text = ret.data.text;
    
    await worker.terminate();
    URL.revokeObjectURL(blobUrl);

    return {
      title: filename,
      text: text,
      pages: [{ text, pageNumber: 1 }]
    };
  }
}
