import { chunkText, chunkParsedDocument } from '../shared/chunker';

interface ParsedDocument {
  title: string;
  text: string;
  pages?: Array<{ text: string; pageNumber: number }>;
  sheets?: Array<{ text: string; sheetName: string }>;
  slides?: Array<{ text: string; slideNumber: number }>;
  isPDF?: boolean;
}

describe('RAG Text Chunker', () => {
  test('should split text on sentence boundaries', () => {
    const text = 'Hello world. This is a sentence! And here is another one? Yes, it is.';
    const chunks = chunkText(text, 40, 10);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toContain('Hello world.');
  });

  test('should respect chunk size limit', () => {
    const text = 'First sentence here. Second sentence follows. Third sentence wraps up.';
    const chunks = chunkText(text, 25, 5);
    
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(35); // Allow some boundary slack
    });
  });

  test('should chunk parsed document by page boundaries', () => {
    const doc: ParsedDocument = {
      title: 'test.pdf',
      text: 'Page 1 text. Page 2 text.',
      pages: [
        { text: 'This is text on page one.', pageNumber: 1 },
        { text: 'This is text on page two.', pageNumber: 2 }
      ],
      isPDF: true
    };

    const chunks = chunkParsedDocument(doc, 100, 10);
    expect(chunks.length).toBe(2);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].text).toContain('page one');
    expect(chunks[1].pageNumber).toBe(2);
    expect(chunks[1].text).toContain('page two');
  });

  test('should chunk parsed document by sheet boundaries', () => {
    const doc: ParsedDocument = {
      title: 'test.xlsx',
      text: 'Row1,Row2',
      sheets: [
        { text: 'A1,B1,C1\nA2,B2,C2', sheetName: 'Sheet1' },
        { text: 'D1,E1,F1', sheetName: 'Sheet2' }
      ]
    };

    const chunks = chunkParsedDocument(doc, 100, 10);
    expect(chunks.length).toBe(2);
    expect(chunks[0].sheetName).toBe('Sheet1');
    expect(chunks[1].sheetName).toBe('Sheet2');
  });
});
