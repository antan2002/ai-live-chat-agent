import { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import ChatHeader from '../components/ChatHeader';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import SuggestedQuestions from '../components/SuggestedQuestions';

export default function ChatPage() {
  const {
    messages,
    isLoading,
    error,
    showSlowWarning,
    send,
    conversations,
    switchConversation,
    newChat,
    activeSessionId,
  } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-page">
      <aside className={`chat-sidebar ${sidebarOpen ? '' : 'chat-sidebar--collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Chats</span>
          <button className="sidebar-new-chat" onClick={newChat}>
            + New Chat
          </button>
        </div>
        <div className="sidebar-list">
          {conversations.map(c => (
            <button
              key={c.id}
              className={`sidebar-item ${c.id === activeSessionId ? 'sidebar-item--active' : ''}`}
              onClick={() => switchConversation(c.id)}
            >
              <span className="sidebar-item-preview">
                {c.preview || 'Empty conversation'}
              </span>
              <span className="sidebar-item-date">
                {new Date(c.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="sidebar-empty">No conversations yet</p>
          )}
        </div>
      </aside>

      <div className={`chat-panel ${sidebarOpen ? '' : 'chat-panel--expanded'}`}>
        <div className="chat-panel-header">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarOpen ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </>
              )}
            </svg>
          </button>
          <ChatHeader />
        </div>

        <div className="message-list">
          {isEmpty && !isLoading && (
            <div className="empty-state">
              <p className="empty-title">Hi there</p>
              <p className="empty-subtitle">How can we help you today?</p>
            </div>
          )}

          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} onOptionSelect={send} />
          ))}

          {isLoading && <TypingIndicator />}

          {showSlowWarning && !error && (
            <p className="slow-warning">
              This is taking longer than usual...
            </p>
          )}
          {error && <p className="error-text">{error}</p>}

          <div ref={bottomRef} />
        </div>

        {isEmpty && !isLoading && <SuggestedQuestions onSelect={send} disabled={isLoading} />}

        <ChatInput onSend={send} disabled={isLoading} />
      </div>
    </div>
  );
}
