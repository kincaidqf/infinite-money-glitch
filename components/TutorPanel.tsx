"use client";

import { useState, useRef, useEffect } from "react";

interface TutorMessage {
  role: "tutor" | "player";
  text: string;
}

interface TutorPanelProps {
  messages?: TutorMessage[];
  loading?: boolean;
  onAsk?: (question: string) => void;
}

export type { TutorMessage };

export default function TutorPanel({
  messages = [],
  loading = false,
  onAsk,
}: TutorPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const question = input.trim();
    if (!question || loading) return;
    onAsk?.(question);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

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
            <div
              key={i}
              className={`tutor-panel__message tutor-panel__message--${msg.role}`}
            >
              <span className="tutor-panel__role">
                {msg.role === "tutor" ? "TUTOR" : "YOU"}
              </span>
              <span className="tutor-panel__text">{msg.text}</span>
            </div>
          ))
        )}
        {loading && (
          <div className="tutor-panel__message tutor-panel__message--tutor tutor-panel__message--loading">
            <span className="tutor-panel__role">TUTOR</span>
            <span className="tutor-panel__text">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="tutor-panel__input-row">
        <input
          className="tutor-panel__input"
          type="text"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !onAsk}
          aria-label="Ask the tutor a question"
        />
        <button
          className="tutor-panel__send"
          onClick={handleSend}
          disabled={loading || !input.trim() || !onAsk}
        >
          Send
        </button>
      </div>
    </aside>
  );
}
