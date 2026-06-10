import type { Message } from '../types/chat';

interface Props {
  message: Message;
  onOptionSelect?: (option: string) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, onOptionSelect }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--agent'}`}>
      {!isUser && <div className="message-avatar">S</div>}
      <div className="message-body">
        <div className={`message-bubble ${isUser ? 'bubble--user' : 'bubble--agent'}`}>
          {message.content}
        </div>
        {message.options && message.options.length > 0 && (
          <div className="message-options">
            {message.options.map((opt, i) => (
              <button key={i} className="option-chip" onClick={() => onOptionSelect?.(opt)}>
                {opt}
              </button>
            ))}
          </div>
        )}
        <span className="message-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}
