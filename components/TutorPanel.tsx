"use client";

interface TutorPanelProps {
  messages?: string[];
}

export default function TutorPanel({ messages = [] }: TutorPanelProps) {
  return (
    <aside className="tutor-panel">
      <h2 className="tutor-panel__heading">Tutor</h2>

      <div className="tutor-panel__messages">
        {messages.length === 0 ? (
          <p className="tutor-panel__empty">
            Start playing and your tutor will provide feedback here.
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="tutor-panel__message">
              {msg}
            </div>
          ))
        )}
      </div>

      <div className="tutor-panel__input-row">
        <input
          className="tutor-panel__input"
          type="text"
          placeholder="Ask a question… (coming soon)"
          disabled
          aria-label="Ask the tutor a question"
        />
        <button className="tutor-panel__send" disabled>Send</button>
      </div>
    </aside>
  );
}
