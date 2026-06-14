import { env, pipeline } from '@huggingface/transformers';
import { TextChunk, DocumentContext } from '../shared/types';
import { ParsedDocument } from './parsers';
import { chunkParsedDocument } from '../shared/chunker';

// Configure Transformers.js to work in extension context
env.allowLocalModels = false;

export interface ChunkWithEmbedding extends TextChunk {
  embedding: number[];
}

export interface StoredDocument {
  title: string;
  text: string;
  timestamp: number;
  isPDF?: boolean;
  chunks: ChunkWithEmbedding[];
}

// Vector DB in IndexedDB wrapper
export class VectorDB {
  private static dbName = 'DocReaderRAG';
  private static storeName = 'documents';

  private static openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(this.storeName, { keyPath: 'title' });
      };
    });
  }

  static async saveDocument(doc: StoredDocument): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(doc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async getDocument(title: string): Promise<StoredDocument | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(title);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteDocument(title: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(title);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async listDocuments(): Promise<string[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve((request.result as string[]) || []);
      request.onerror = () => reject(request.error);
    });
  }
}

// RAG pipeline manager
export class RAGPipeline {
  private static embedder: any = null;

  static async initEmbedder(onProgress?: (progress: number) => void): Promise<void> {
    if (this.embedder) return;
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.progress) {
          onProgress?.(info.progress);
        }
      }
    });
  }

  static async getEmbedding(text: string): Promise<number[]> {
    await this.initEmbedder();
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  static async ingestDocument(parsedDoc: ParsedDocument, onProgress?: (msg: string) => void): Promise<StoredDocument> {
    onProgress?.('Chunking document contents...');
    const rawChunks = chunkParsedDocument(parsedDoc);
    const chunksWithEmbedding: ChunkWithEmbedding[] = [];

    onProgress?.('Initializing embedding model...');
    await this.initEmbedder((progress) => {
      onProgress?.(`Downloading embedding model: ${Math.round(progress * 100)}%`);
    });

    for (let i = 0; i < rawChunks.length; i++) {
      onProgress?.(`Generating vectors for chunk ${i + 1} of ${rawChunks.length}...`);
      const chunk = rawChunks[i];
      const embedding = await this.getEmbedding(chunk.text);
      chunksWithEmbedding.push({
        ...chunk,
        embedding
      });
    }

    const storedDoc: StoredDocument = {
      title: parsedDoc.title,
      text: parsedDoc.text,
      timestamp: Date.now(),
      isPDF: parsedDoc.isPDF,
      chunks: chunksWithEmbedding
    };

    onProgress?.('Saving to IndexedDB...');
    await VectorDB.saveDocument(storedDoc);
    return storedDoc;
  }

  static async retrieveRelevantChunks(docTitle: string, query: string, topK = 4): Promise<ChunkWithEmbedding[]> {
    const doc = await VectorDB.getDocument(docTitle);
    if (!doc || doc.chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.getEmbedding(query);
    const scoredChunks = doc.chunks.map((chunk) => {
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, score };
    });

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks.slice(0, topK).map((sc) => sc.chunk);
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    // Vectors are normalized by pipeline, so similarity is just the dot product
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}
