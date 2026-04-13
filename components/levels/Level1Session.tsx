"use client";
// ============================================================
// LEVEL 1 TEAM — Replace this stub with your Level 1 UI.
// Game state logic: game/levels/level1/gameLogic.ts
// Tutor prompts:   game/levels/level1/tutorPrompts.ts
// SDD reference:   Blackjack_Tutor_SDD.md §Level 1
//
// Requirements from SDD:
//   - Full simulated shoe with Hit/Stand/Double/Split buttons
//   - Immediate feedback after each decision (basic strategy check)
//   - Score tracker showing correct/total decisions
//   - Tutor panel for hints and explanations
//   - No mention of card counting in UI or tutor responses
// ============================================================

import GameSession from "@/components/GameSession";
import type { Level } from "@/lib/types";

export default function Level1Session({ level }: { level: Level }) {
  return <GameSession level={level} />;
}
