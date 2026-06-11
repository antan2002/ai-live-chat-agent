import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, ChatState } from '../types/chat';
import {
  sendMessage,
  fetchConversations,
  fetchHistory,
  type ConversationSummary,
} from '../services/chatApi';

type RawMessage = {
  id: string;
  sender: string;
  text: string;
  created_at: string;
};

function loadSessionId(): string {
  return localStorage.getItem('sessionId') ?? '';
}

function saveSessionId(id: string): void {
  localStorage.setItem('sessionId', id);
}

function parseReply(raw: string): { content: string; options?: string[] } {
  const match = raw.match(/([\s\S]*?)\{"options":\s*(\[[\s\S]*?\])\}\s*$/);
  if (!match) return { content: raw };
  try {
    return { content: match[1].trim(), options: JSON.parse(match[2]) };
  } catch { return { content: raw }; }
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    showSlowWarning: false,
  });

  const [sessionId, setSessionId] = useState(loadSessionId);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  useEffect(() => {
    if (!state.isLoading) {
      setState(prev => prev.showSlowWarning ? { ...prev, showSlowWarning: false } : prev);
      return;
    }
    const timer = setTimeout(() => {
      setState(prev => prev.isLoading ? { ...prev, showSlowWarning: true } : prev);
    }, 10000);
    return () => clearTimeout(timer);
  }, [state.isLoading]);

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch((err) => console.error('Failed to load conversations on mount:', err));
  }, []);

  const switchConversation = useCallback(async (id: string) => {
    setSessionId(id);
    saveSessionId(id);
    sessionIdRef.current = id;
    setState({ messages: [], isLoading: true, error: null, showSlowWarning: false });
    try {
      const history = await fetchHistory(id);
      if (sessionIdRef.current !== id) return;
      const messages: Message[] = history.map((m: RawMessage) => ({
        id: m.id,
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
        timestamp: new Date(m.created_at),
      }));
      setState({ messages, isLoading: false, error: null, showSlowWarning: false });
    } catch {
      setState({ messages: [], isLoading: false, error: 'Could not load conversation. Please try again.', showSlowWarning: false });
    }
  }, []);

  const refreshConversations = useCallback(() => {
    fetchConversations()
      .then(setConversations)
      .catch((err) => {
        console.error('Failed to refresh conversations:', err);
      });
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
        showSlowWarning: false,
      }));

      try {
        const currentSession = sessionIdRef.current;
        const data = await sendMessage(trimmed, currentSession || undefined);

        if (sessionIdRef.current !== currentSession) return;

        if (!currentSession) {
          setSessionId(data.sessionId);
          saveSessionId(data.sessionId);
        }

        const parsed = parseReply(data.reply);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: parsed.content,
          options: parsed.options,
          timestamp: new Date(),
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
          showSlowWarning: false,
        }));

        refreshConversations();
      } catch {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Something went wrong. Please try again.',
          showSlowWarning: false,
        }));
      }
    },
    [refreshConversations]
  );

  const newChat = useCallback(() => {
    setSessionId('');
    localStorage.removeItem('sessionId');
    setState({ messages: [], isLoading: false, error: null, showSlowWarning: false });
  }, []);

  return {
    ...state,
    send,
    conversations,
    switchConversation,
    newChat,
    activeSessionId: sessionId,
  };
}
