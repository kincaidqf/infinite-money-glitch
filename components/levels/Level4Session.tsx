"use client";
// ============================================================
// LEVEL 4 TEAM — Replace this stub with your Level 4 UI.
// Game state logic: game/levels/level4/gameLogic.ts
// Tutor prompts:   game/levels/level4/tutorPrompts.ts
// SDD reference:   Blackjack_Tutor_SDD.md §Level 4
//
// Requirements from SDD:
//   - Bet sizing slider/input before each hand
//   - Bankroll display with trajectory tracking
//   - Full session debrief: count accuracy, decision quality,
//     bet-sizing efficiency, and bankroll trajectory
//   - All prior features (Basic Strategy + count + index plays)
//   - LLM evaluates bet proportionality relative to true count edge
// ============================================================

import GameSession from "@/components/GameSession";
import type { Level } from "@/lib/types";

export default function Level4Session({ level }: { level: Level }) {
  return <GameSession level={level} />;
}
