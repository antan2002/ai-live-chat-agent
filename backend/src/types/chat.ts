export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: Date;
}

export interface Conversation {
  id: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
}
