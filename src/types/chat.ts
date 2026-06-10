export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  options?: string[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  showSlowWarning: boolean;
}
