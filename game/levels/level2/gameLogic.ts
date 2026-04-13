// ============================================================
// LEVEL 2 TEAM — Implement Level 2 game logic here.
// All exports must be pure functions (no DOM, no React state).
// See Blackjack_Tutor_SDD.md §Level 2 for the full spec.
//
// Shared utilities you can import:
//   import { initShoe, dealCard } from "@/game/deckState";
//   import type { Card } from "@/lib/cards";
//
// Hi-Lo values are already on each card: card.hiLoValue (+1/0/-1)
// ============================================================

import type { Card } from "@/lib/cards";

export type CountDirection = "positive" | "neutral" | "negative";

export interface Level2State {
  phase: "drill" | "session-over";
  revealedCards: Card[];
  runningCount: number;
  correctClassifications: number;
  totalClassifications: number;
  currentStreak: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
}

export function getInitialLevel2State(): Level2State {
  return {
    phase: "drill",
    revealedCards: [],
    runningCount: 0,
    correctClassifications: 0,
    totalClassifications: 0,
    currentStreak: 0,
    sessionComplete: false,
    lastFeedback: null,
  };
}

export function getCountDirection(runningCount: number): CountDirection {
  if (runningCount > 0) return "positive";
  if (runningCount < 0) return "negative";
  return "neutral";
}

export function getLevel2GameContext(state: Level2State): string {
  const accuracy =
    state.totalClassifications > 0
      ? ((state.correctClassifications / state.totalClassifications) * 100).toFixed(1)
      : "0.0";
  return [
    "Level 2 — Hi-Lo Count Classification Drill",
    `Cards revealed: ${state.revealedCards.length}`,
    `Running count: ${state.runningCount}`,
    `Count direction: ${getCountDirection(state.runningCount)}`,
    `Classifications: ${state.correctClassifications}/${state.totalClassifications} correct (${accuracy}%)`,
    `Current streak: ${state.currentStreak}`,
    `Phase: ${state.phase}`,
  ].join("\n");
}
