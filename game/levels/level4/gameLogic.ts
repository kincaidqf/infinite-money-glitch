// ============================================================
// LEVEL 4 TEAM — Implement Level 4 game logic here.
// All exports must be pure functions (no DOM, no React state).
// See Blackjack_Tutor_SDD.md §Level 4 for the full spec.
//
// Shared utilities you can import:
//   import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
//   import { getBasicStrategyAction, evaluateDecision } from "@/game/basicStrategy";
//   import { initShoe, dealCard, getTrueCount } from "@/game/deckState";
//   import type { Card } from "@/lib/cards";
// ============================================================

import type { Card } from "@/lib/cards";

export interface BetSizingEval {
  playerBet: number;
  recommendedBet: number;
  trueCountAtBet: number;
  wasProportional: boolean;
}

export interface Level4State {
  phase: "dealing" | "bet-sizing" | "player-turn" | "dealer-turn" | "round-over" | "session-over";
  playerHand: Card[];
  dealerHand: Card[];
  bankroll: number;
  currentBet: number;
  runningCount: number;
  trueCount: number;
  betHistory: BetSizingEval[];
  correctDecisions: number;
  totalDecisions: number;
  correctCountEntries: number;
  totalCountEntries: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
}

export function getInitialLevel4State(startingBankroll: number = 1000): Level4State {
  return {
    phase: "bet-sizing",
    playerHand: [],
    dealerHand: [],
    bankroll: startingBankroll,
    currentBet: 0,
    runningCount: 0,
    trueCount: 0,
    betHistory: [],
    correctDecisions: 0,
    totalDecisions: 0,
    correctCountEntries: 0,
    totalCountEntries: 0,
    sessionComplete: false,
    lastFeedback: null,
  };
}

export function getLevel4GameContext(state: Level4State): string {
  const decisionAccuracy =
    state.totalDecisions > 0
      ? ((state.correctDecisions / state.totalDecisions) * 100).toFixed(1)
      : "0.0";
  const proportionalBets = state.betHistory.filter((b) => b.wasProportional).length;
  const betAccuracy =
    state.betHistory.length > 0
      ? ((proportionalBets / state.betHistory.length) * 100).toFixed(1)
      : "0.0";
  return [
    "Level 4 — Bet Sizing & Bankroll Management",
    `Player hand: ${state.playerHand.map((c) => c.rank).join(", ") || "none"}`,
    `Dealer upcard: ${state.dealerHand[0]?.rank ?? "hidden"}`,
    `Bankroll: $${state.bankroll}`,
    `Current bet: $${state.currentBet}`,
    `Running count: ${state.runningCount}`,
    `True count: ${state.trueCount}`,
    `Decision accuracy: ${state.correctDecisions}/${state.totalDecisions} (${decisionAccuracy}%)`,
    `Bet sizing accuracy: ${proportionalBets}/${state.betHistory.length} proportional (${betAccuracy}%)`,
    `Phase: ${state.phase}`,
  ].join("\n");
}
