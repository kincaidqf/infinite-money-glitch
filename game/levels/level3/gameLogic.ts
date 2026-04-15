import type { Card } from "@/lib/cards";
import type { DeckState } from "@/game/deckState";
import { initShoe, dealCard } from "@/game/deckState";
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
import { evaluateDecision, type UserAction } from "@/game/basicStrategy";

export interface Level3State {
  phase: "dealing" | "player-turn" | "dealer-turn" | "count-entry" | "round-over" | "session-over";
  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];
  runningCount: number;
  trueCount: number;
  playerEnteredCount: number | null;
  correctCountEntries: number;
  totalCountEntries: number;
  correctDecisions: number;
  totalDecisions: number;
  consecutiveCorrectDecisions: number;
  missedIndexPlays: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
  roundDecisionCorrect: boolean;
  lastIndexPlay: string | null;
  countWasCorrect: boolean | null;
}

export function getInitialLevel3State(): Level3State {
  return {
    phase: "dealing",
    shoe: initShoe(6),
    playerHand: [],
    dealerHand: [],
    runningCount: 0,
    trueCount: 0,
    playerEnteredCount: null,
    correctCountEntries: 0,
    totalCountEntries: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    consecutiveCorrectDecisions: 0,
    missedIndexPlays: 0,
    sessionComplete: false,
    lastFeedback: null,
    roundDecisionCorrect: true,
    lastIndexPlay: null,
    countWasCorrect: null,
  };
}

// Pure true-count formula: RC ÷ decks remaining, rounded to 1 decimal.
export function getTrueCount(rc: number, decksRemaining: number): number {
  if (decksRemaining <= 0) return rc;
  const safe = decksRemaining < 0.5 ? 0.5 : decksRemaining;
  return Math.round((rc / safe) * 10) / 10;
}

// Illustrious 18 subset — returns override action or null. dealerUpcard is blackjackValue.
export function getIndexPlay(
  playerTotal: number,
  dealerUpcard: number,
  isSoftHand: boolean,
  trueCount: number
): string | null {
  if (isSoftHand) return null;
  if (trueCount >= 3 && dealerUpcard === 11) return "take-insurance";
  if (playerTotal === 16 && dealerUpcard === 10 && trueCount >= 0) return "stand";
  if (playerTotal === 15 && dealerUpcard === 10 && trueCount >= 4) return "stand";
  if (playerTotal === 10 && dealerUpcard === 10 && trueCount >= 4) return "double";
  if (playerTotal === 10 && dealerUpcard === 11 && trueCount >= 4) return "double";
  if (playerTotal === 12 && dealerUpcard === 3 && trueCount >= 2) return "stand";
  if (playerTotal === 12 && dealerUpcard === 2 && trueCount >= 3) return "stand";
  if (playerTotal === 11 && dealerUpcard === 11 && trueCount >= 1) return "double";
  if (playerTotal === 9 && dealerUpcard === 2 && trueCount >= 1) return "double";
  if (playerTotal === 9 && dealerUpcard === 7 && trueCount >= 3) return "double";
  return null;
}

export function getLevel3GameContext(state: Level3State): string {
  const cntPct = state.totalCountEntries > 0
    ? ((state.correctCountEntries / state.totalCountEntries) * 100).toFixed(1) : "0.0";
  const decPct = state.totalDecisions > 0
    ? ((state.correctDecisions / state.totalDecisions) * 100).toFixed(1) : "0.0";
  return [
    "Level 3 — Running Count & True Count Mastery",
    `Player hand: ${state.playerHand.map((c) => c.rank).join(", ") || "none"}`,
    `Dealer upcard: ${state.dealerHand[0]?.rank ?? "hidden"}`,
    `Running count (actual): ${state.runningCount}`,
    `True count (actual): ${state.trueCount}`,
    `Player entered count: ${state.playerEnteredCount ?? "not yet entered"}`,
    `Count accuracy: ${state.correctCountEntries}/${state.totalCountEntries} (${cntPct}%)`,
    `Decision accuracy: ${state.correctDecisions}/${state.totalDecisions} (${decPct}%)`,
    `Consecutive correct decisions: ${state.consecutiveCorrectDecisions}`,
    `Missed index plays: ${state.missedIndexPlays}`,
    `Phase: ${state.phase}`,
  ].join("\n");
}

function draw(shoe: DeckState): { card: Card; shoe: DeckState } {
  const { card, newState } = dealCard(shoe);
  return { card, shoe: newState };
}

export function dealInitialCards(state: Level3State): Level3State {
  let s = state.shoe.shoe.length < 20 ? initShoe(6) : state.shoe;
  const draws: Card[] = [];
  for (let i = 0; i < 4; i++) {
    const { card, shoe: next } = draw(s);
    draws.push(card);
    s = next;
  }
  return {
    ...state,
    shoe: s,
    playerHand: [draws[0], draws[2]],
    dealerHand: [draws[1], draws[3]],
    runningCount: s.runningCount,
    trueCount: getTrueCount(s.runningCount, s.shoe.length / 52),
    phase: "player-turn",
    playerEnteredCount: null,
    roundDecisionCorrect: true,
    lastIndexPlay: null,
    countWasCorrect: null,
    lastFeedback: null,
  };
}

export function applyPlayerAction(state: Level3State, action: UserAction): Level3State {
  const { playerHand, dealerHand, shoe } = state;
  const doubleAvailable = playerHand.length === 2;
  const playerTotal = calculateHandValue(playerHand);
  const soft = isSoft(playerHand);
  const indexPlay = getIndexPlay(playerTotal, dealerHand[0].blackjackValue, soft, state.trueCount);

  let correct: boolean;
  let missed = 0;
  if (indexPlay && indexPlay !== "take-insurance") {
    correct = action === (indexPlay as UserAction);
    if (!correct) missed = 1;
  } else {
    correct = evaluateDecision(playerHand, dealerHand[0], action, doubleAvailable).correct;
  }

  let newShoe = shoe;
  let newHand = playerHand;
  if (action === "hit" || action === "double") {
    const { card, shoe: next } = draw(shoe);
    newHand = [...playerHand, card];
    newShoe = next;
  }

  const bust = isBust(newHand);
  const nextPhase: Level3State["phase"] =
    action === "stand" ? "dealer-turn"
    : action === "double" && !bust ? "dealer-turn"
    : bust ? "count-entry"
    : "player-turn";

  return {
    ...state,
    shoe: newShoe,
    playerHand: newHand,
    runningCount: newShoe.runningCount,
    trueCount: getTrueCount(newShoe.runningCount, newShoe.shoe.length / 52),
    correctDecisions: state.correctDecisions + (correct ? 1 : 0),
    totalDecisions: state.totalDecisions + 1,
    roundDecisionCorrect: state.roundDecisionCorrect && correct,
    missedIndexPlays: state.missedIndexPlays + missed,
    lastIndexPlay: missed ? indexPlay : state.lastIndexPlay,
    phase: nextPhase,
  };
}

export function runDealerTurn(state: Level3State): Level3State {
  let shoe = state.shoe;
  let dealerHand = [...state.dealerHand];
  while (calculateHandValue(dealerHand) < 17) {
    const { card, shoe: next } = draw(shoe);
    dealerHand = [...dealerHand, card];
    shoe = next;
  }
  return {
    ...state,
    shoe,
    dealerHand,
    runningCount: shoe.runningCount,
    trueCount: getTrueCount(shoe.runningCount, shoe.shoe.length / 52),
    phase: "count-entry",
  };
}

export function submitCountEntry(state: Level3State, entered: number): Level3State {
  const countCorrect = Math.abs(entered - state.runningCount) <= 1;
  const roundCorrect = state.roundDecisionCorrect && countCorrect;
  const newStreak = roundCorrect ? state.consecutiveCorrectDecisions + 1 : 0;
  const sessionComplete = newStreak >= 5;
  return {
    ...state,
    playerEnteredCount: entered,
    correctCountEntries: state.correctCountEntries + (countCorrect ? 1 : 0),
    totalCountEntries: state.totalCountEntries + 1,
    consecutiveCorrectDecisions: newStreak,
    sessionComplete,
    countWasCorrect: countCorrect,
    phase: sessionComplete ? "session-over" : "round-over",
  };
}

export function startNewRound(state: Level3State): Level3State {
  return {
    ...state,
    phase: "dealing",
    playerHand: [],
    dealerHand: [],
    playerEnteredCount: null,
    roundDecisionCorrect: true,
    lastIndexPlay: null,
    countWasCorrect: null,
    lastFeedback: null,
  };
}
