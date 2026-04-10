"use client";

import { useState, useCallback, useRef } from "react";
import GameBoard from "@/components/GameBoard";
import TutorPanel, { type TutorMessage } from "@/components/TutorPanel";
import { useTutor } from "@/lib/useTutor";
import type { Level } from "@/lib/types";

interface GameSessionProps {
  level: Level;
}

const DEBOUNCE_MS = 1500;

export default function GameSession({ level }: GameSessionProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const lastCallRef = useRef<number>(0);

  const { callTutor, loading } = useTutor({
    onError: (err) => {
      setMessages((prev) => [...prev, { role: "tutor", text: `Error: ${err}` }]);
    },
  });

  const addTutorMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "tutor", text }]);
  }, []);

  const handleDecision = useCallback(
    async (gameContext: string) => {
      const now = Date.now();
      if (now - lastCallRef.current < DEBOUNCE_MS) return;
      lastCallRef.current = now;

      const response = await callTutor("feedback", gameContext);
      if (response) addTutorMessage(response);
    },
    [callTutor, addTutorMessage]
  );

  const handleAsk = useCallback(
    async (question: string) => {
      setMessages((prev) => [...prev, { role: "player", text: question }]);
      const response = await callTutor("explain", question);
      if (response) addTutorMessage(response);
    },
    [callTutor, addTutorMessage]
  );

  return (
    <div className="game-layout">
      <GameBoard level={level} onDecision={handleDecision} />
      <TutorPanel messages={messages} loading={loading} onAsk={handleAsk} />
    </div>
  );
}
