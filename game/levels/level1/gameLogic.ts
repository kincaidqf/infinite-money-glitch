// ============================================================
// LEVEL 1 TEAM — Implement Level 1 game logic here.
// All exports must be pure functions (no DOM, no React state).
// See Blackjack_Tutor_SDD.md §Level 1 for the full spec.
//
// Shared utilities you can import:
//   import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
//   import { getBasicStrategyAction, evaluateDecision } from "@/game/basicStrategy";
//   import { initShoe, dealCard, getProbabilities } from "@/game/deckState";
//   import type { Card } from "@/lib/cards";
// ============================================================

import type { Card } from "@/lib/cards";

export interface Level1State {
  phase: "dealing" | "player-turn" | "dealer-turn" | "round-over" | "session-over";
  playerHand: Card[];
  dealerHand: Card[];
  correctDecisions: number;
  totalDecisions: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
}

export function getInitialLevel1State(): Level1State {
  return {
    phase: "dealing",
    playerHand: [],
    dealerHand: [],
    correctDecisions: 0,
    totalDecisions: 0,
    sessionComplete: false,
    lastFeedback: null,
  };
}

export function getLevel1GameContext(state: Level1State): string {
  const accuracy =
    state.totalDecisions > 0
      ? ((state.correctDecisions / state.totalDecisions) * 100).toFixed(1)
      : "0.0";
  return [
    "Level 1 — Basic Strategy Practice",
    `Player hand: ${state.playerHand.map((c) => c.rank).join(", ") || "none"}`,
    `Dealer upcard: ${state.dealerHand[0]?.rank ?? "hidden"}`,
    `Decisions: ${state.correctDecisions}/${state.totalDecisions} correct (${accuracy}%)`,
    `Phase: ${state.phase}`,
  ].join("\n");
}
