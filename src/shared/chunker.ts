import { TextChunk } from './types';
import { ParsedDocument } from '../offscreen/parsers';

// Basic text chunker helper
export function chunkText(text: string, chunkSize = 2000, overlapSize = 300): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      const sentencesInCurrent = currentChunk.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
      let overlapText = '';
      for (let i = sentencesInCurrent.length - 1; i >= 0; i--) {
        if ((overlapText + sentencesInCurrent[i]).length <= overlapSize) {
          overlapText = sentencesInCurrent[i] + overlapText;
        } else {
          break;
        }
      }
      currentChunk = overlapText + sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Chunks a parsed document while preserving page/sheet/slide boundaries for citation
export function chunkParsedDocument(doc: ParsedDocument, chunkSize = 2000, overlapSize = 300): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  if (doc.pages && doc.pages.length > 0) {
    for (const page of doc.pages) {
      const texts = chunkText(page.text, chunkSize, overlapSize);
      texts.forEach(text => {
        chunks.push({
          text,
          index: chunkIndex++,
          pageNumber: page.pageNumber
        });
      });
    }
  } else if (doc.slides && doc.slides.length > 0) {
    for (const slide of doc.slides) {
      const texts = chunkText(slide.text, chunkSize, overlapSize);
      texts.forEach(text => {
        chunks.push({
          text,
          index: chunkIndex++,
          pageNumber: slide.slideNumber
        });
      });
    }
  } else if (doc.sheets && doc.sheets.length > 0) {
    for (const sheet of doc.sheets) {
      const rows = sheet.text.split('\n');
      let currentChunk = '';
      for (const row of rows) {
        if ((currentChunk + '\n' + row).length > chunkSize) {
          if (currentChunk.trim().length > 0) {
            chunks.push({
              text: currentChunk.trim(),
              index: chunkIndex++,
              sheetName: sheet.sheetName
            });
          }
          const overlapRows = currentChunk.split('\n');
          let overlapText = '';
          for (let i = overlapRows.length - 1; i >= 0; i--) {
            if ((overlapText + '\n' + overlapRows[i]).length <= overlapSize) {
              overlapText = overlapRows[i] + '\n' + overlapText;
            } else {
              break;
            }
          }
          currentChunk = overlapText + row;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + row : row;
        }
      }
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          sheetName: sheet.sheetName
        });
      }
    }
  } else {
    const texts = chunkText(doc.text, chunkSize, overlapSize);
    texts.forEach(text => {
      chunks.push({
        text,
        index: chunkIndex++
      });
    });
  }
  return chunks;
}
