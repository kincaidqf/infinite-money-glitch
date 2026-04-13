// ============================================================
// LEVEL 3 TEAM — Implement Level 3 game logic here.
// All exports must be pure functions (no DOM, no React state).
// See Blackjack_Tutor_SDD.md §Level 3 for the full spec.
//
// Shared utilities you can import:
//   import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
//   import { getBasicStrategyAction, evaluateDecision } from "@/game/basicStrategy";
//   import { initShoe, dealCard, getTrueCount } from "@/game/deckState";
//   import type { Card } from "@/lib/cards";
// ============================================================

import type { Card } from "@/lib/cards";

export interface Level3State {
  phase: "dealing" | "player-turn" | "dealer-turn" | "count-entry" | "round-over" | "session-over";
  playerHand: Card[];
  dealerHand: Card[];
  runningCount: number;
  trueCount: number;
  playerEnteredCount: number | null;
  correctCountEntries: number;
  totalCountEntries: number;
  correctDecisions: number;
  totalDecisions: number;
  missedIndexPlays: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
}

export function getInitialLevel3State(): Level3State {
  return {
    phase: "dealing",
    playerHand: [],
    dealerHand: [],
    runningCount: 0,
    trueCount: 0,
    playerEnteredCount: null,
    correctCountEntries: 0,
    totalCountEntries: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    missedIndexPlays: 0,
    sessionComplete: false,
    lastFeedback: null,
  };
}

export function getLevel3GameContext(state: Level3State): string {
  const countAccuracy =
    state.totalCountEntries > 0
      ? ((state.correctCountEntries / state.totalCountEntries) * 100).toFixed(1)
      : "0.0";
  const decisionAccuracy =
    state.totalDecisions > 0
      ? ((state.correctDecisions / state.totalDecisions) * 100).toFixed(1)
      : "0.0";
  return [
    "Level 3 — Running Count & True Count Mastery",
    `Player hand: ${state.playerHand.map((c) => c.rank).join(", ") || "none"}`,
    `Dealer upcard: ${state.dealerHand[0]?.rank ?? "hidden"}`,
    `Running count: ${state.runningCount}`,
    `True count: ${state.trueCount}`,
    `Player entered count: ${state.playerEnteredCount ?? "not yet entered"}`,
    `Count accuracy: ${state.correctCountEntries}/${state.totalCountEntries} (${countAccuracy}%)`,
    `Decision accuracy: ${state.correctDecisions}/${state.totalDecisions} (${decisionAccuracy}%)`,
    `Missed index plays: ${state.missedIndexPlays}`,
    `Phase: ${state.phase}`,
  ].join("\n");
}
