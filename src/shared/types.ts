export interface ExtensionMessage {
  type: string;
  payload?: any;
  error?: string;
}

// Data structures
export interface TextChunk {
  text: string;
  index: number;
  pageNumber?: number;
  sheetName?: string;
}

export interface DocumentContext {
  url: string;
  title: string;
  text: string;
  timestamp: number;
  isPDF?: boolean;
  chunks?: TextChunk[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: Array<{ text: string; pageNumber?: number; sheetName?: string }>;
}

export interface ChatSession {
  id: string;
  documentTitle: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ExtensionSettings {
  modelSize: 'Tiny' | 'Balanced' | 'Quality';
}

export interface AppState {
  currentModel: string;
  isModelLoaded: boolean;
  currentDocument: DocumentContext | null;
  chatSessions: ChatSession[];
  settings: ExtensionSettings;
}
