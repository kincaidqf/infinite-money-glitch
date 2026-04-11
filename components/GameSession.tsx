"use client";

import { useState, useCallback } from "react";
import GameBoard from "@/components/GameBoard";
import TutorPanel, { type TutorMessage } from "@/components/TutorPanel";
import { useTutor } from "@/lib/useTutor";
import type { Level } from "@/lib/types";

interface GameSessionProps {
  level: Level;
}

export default function GameSession({ level }: GameSessionProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);

  const { callTutor, loading } = useTutor({
    onError: (err) => {
      setMessages((prev) => [...prev, { role: "tutor", text: `Error: ${err}` }]);
    },
  });

  const handleAsk = useCallback(
    async (question: string) => {
      setMessages((prev) => [...prev, { role: "player", text: question }]);
      const response = await callTutor("explain", question);
      if (response) setMessages((prev) => [...prev, { role: "tutor", text: response }]);
    },
    [callTutor]
  );

  return (
    <div className="game-layout">
      <GameBoard level={level} />
      <TutorPanel messages={messages} loading={loading} onAsk={handleAsk} />
    </div>
  );
}
