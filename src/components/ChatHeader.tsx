export default function ChatHeader() {
  return (
    <div className="chat-header">
      <div className="agent-avatar">S</div>
      <div className="agent-info">
        <span className="agent-name">Support Agent</span>
        <span className="agent-status">
          <span className="status-dot" />
          Online
        </span>
      </div>
    </div>
  );
}
