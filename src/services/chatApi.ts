export interface SendMessageResponse {
  reply: string;
  sessionId: string;
  options?: string[];
}

export interface ConversationSummary {
  id: string;
  preview: string;
  created_at: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendMessageResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${BASE_URL}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Server error: ${response.status}`);
  }

  return response.json();
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await fetch(`${BASE_URL}/chat/conversations`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

export interface RawMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
}

export async function fetchHistory(sessionId: string): Promise<RawMessage[]> {
  const response = await fetch(`${BASE_URL}/chat/history/${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }
  return response.json();
}
