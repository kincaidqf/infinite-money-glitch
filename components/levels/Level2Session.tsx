"use client";
// ============================================================
// LEVEL 2 TEAM — Replace this stub with your Level 2 UI.
// Game state logic: game/levels/level2/gameLogic.ts
// Tutor prompts:   game/levels/level2/tutorPrompts.ts
// SDD reference:   Blackjack_Tutor_SDD.md §Level 2
//
// Requirements from SDD:
//   - Card reveal drill (one card at a time)
//   - Player classifies running count direction: Positive / Neutral / Negative
//   - Drill speed increases on correct classification streaks
//   - Score tracker showing classification accuracy
//   - Tutor panel with immediate classification feedback
// ============================================================

import GameSession from "@/components/GameSession";
import type { Level } from "@/lib/types";

export default function Level2Session({ level }: { level: Level }) {
  return <GameSession level={level} />;
}
