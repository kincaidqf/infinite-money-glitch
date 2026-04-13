"use client";
// ============================================================
// LEVEL 3 TEAM — Replace this stub with your Level 3 UI.
// Game state logic: game/levels/level3/gameLogic.ts
// Tutor prompts:   game/levels/level3/tutorPrompts.ts
// SDD reference:   Blackjack_Tutor_SDD.md §Level 3
//
// Requirements from SDD:
//   - Full simulated shoe with Basic Strategy + count tracking
//   - Player enters running count after each hand (text input or +/- stepper)
//   - Count accuracy and decision accuracy tracked separately
//   - Missed index plays identified and flagged in session summary
//   - Full running count and true count visible to player and tutor
// ============================================================

import GameSession from "@/components/GameSession";
import type { Level } from "@/lib/types";

export default function Level3Session({ level }: { level: Level }) {
  return <GameSession level={level} />;
}
