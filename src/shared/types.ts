// Message types for extension communication
export interface ExtensionMessage {
  type: string;
  payload?: any;
  error?: string;
}

export interface PageTextMessage extends ExtensionMessage {
  type: 'PAGE_TEXT_EXTRACTED';
  payload: {
    url: string;
    title: string;
    text: string;
    isPDF?: boolean;
    timestamp: number;
  };
}

export interface ChatMessage extends ExtensionMessage {
  type: 'CHAT_MESSAGE';
  payload: {
    message: string;
    context?: string;
    sessionId: string;
  };
}

export interface ModelProgressMessage extends ExtensionMessage {
  type: 'MODEL_PROGRESS';
  payload: {
    progress: number;
    stage: string;
    timeElapsed: number;
  };
}

export interface ChatReplyMessage extends ExtensionMessage {
  type: 'CHAT_REPLY';
  payload: {
    text: string;
  };
}

export interface DocumentReadyMessage extends ExtensionMessage {
  type: 'DOCUMENT_READY';
  payload: {
    title: string;
  };
}

export interface InitOffscreenMessage extends ExtensionMessage {
  type: 'INIT_OFFSCREEN';
}

export interface InitModelMessage extends ExtensionMessage {
  type: 'INIT_MODEL';
}

// Application state types
export interface AppState {
  currentModel: string;
  isModelLoaded: boolean;
  currentDocument: DocumentContext | null;
  chatSessions: ChatSession[];
  settings: ExtensionSettings;
}

export interface DocumentContext {
  url: string;
  title: string;
  content: string;
  extractedAt: number;
  chunks?: TextChunk[];
}

export interface ChatSession {
  id: string;
  documentUrl: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TextChunk {
  text: string;
  index: number;
  startOffset: number;
  endOffset: number;
}

export interface ExtensionSettings {
  modelSize: string;
  autoExtract: boolean;
  enableHistory: boolean;
}

