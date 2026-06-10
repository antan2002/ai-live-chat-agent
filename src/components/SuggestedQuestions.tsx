interface Props {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

const suggestions = [
  "What's your return policy?",
  "Do you ship to USA?",
  "How do I track my order?",
  "Can I change my order?",
];

export default function SuggestedQuestions({ onSelect, disabled }: Props) {
  return (
    <div className="suggestions">
      <p className="suggestions-label">Common questions</p>
      <div className="suggestions-list">
        {suggestions.map(q => (
          <button key={q} className="suggestion-chip" disabled={disabled} onClick={() => onSelect(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
