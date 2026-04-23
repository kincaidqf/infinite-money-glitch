import type { Card } from "@/lib/cards";
import type { DeckState } from "@/game/deckState";
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
import { getBasicStrategyAction } from "@/game/basicStrategy";
import { initShoe, dealCard } from "@/game/deckState";
import type { BustQuizData, QuizStep } from "./quizLogic";

export type Level1Stage = 1 | 2 | 3 | 4 | 5;
export type Level1Phase =
  | "tutor-intro"
  | "player-turn"
  | "dealer-turn"
  | "round-over"
  | "tutor-feedback"
  | "bust-quiz"
  | "session-over";

export const STAGE2_HAND_COUNT = 3;
export const STAGE4_HAND_COUNT = 3;
export const STAGE5_BLOCK_SIZE = 5;
export const WIN_STREAK = 5;

export interface HandDecision {
  action: "hit" | "stand";
  total: number;
  soft: boolean;
  correct: boolean;
  dealerUpcard: string;
}

export interface BlockHandSummary {
  handNumber: number;
  decisions: HandDecision[];
  outcome: "win" | "loss" | "push" | null;
  playerHandAtStart: string;
  dealerUpcard: string;
}

export interface Level1State {
  stage: Level1Stage;
  phase: Level1Phase;
  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];
  correctDecisions: number;
  totalDecisions: number;
  consecutiveCorrect: number;
  lastDecisionCorrect: boolean | null;
  sessionComplete: boolean;
  lastOutcome: "win" | "loss" | "push" | null;
  // Per-hand decision tracking
  handDecisions: HandDecision[];
  // Snapshot of player hand at first decision moment (pre-draw)
  decisionHandAtAction: Card[] | null;
  decisionDealerUpcard: Card | null;
  sessionWins: number;
  sessionLosses: number;
  dealerBustProbability: number | null;
  playerBustProbability: number | null;
  stage2HandsPlayed: number;
  stage4HandsPlayed: number;
  stage4IntroShown: boolean;
  stage5BlockHandsPlayed: number;
  blockDecisionLog: BlockHandSummary[];
  lastWrongDecision: "hit" | "stand" | null;
  lastWrongDecisionTotal: number | null;
  lastWrongDecisionSoft: boolean | null;
  bustQuizData: BustQuizData | null;
  bustQuizStep: QuizStep;
}

// 16 of 52 cards are 10-value (10, J, Q, K × 4 suits) — the foundational probability of Level 1
export const TEN_VALUE_PROBABILITY = 16 / 52;

const DEALER_BUST_PROB: Record<string, number> = {
  "2": 0.353, "3": 0.376, "4": 0.403, "5": 0.429, "6": 0.423,
  "7": 0.262, "8": 0.244, "9": 0.230, "10": 0.214,
  "J": 0.214, "Q": 0.214, "K": 0.214, "A": 0.117,
};

// Probability of busting if you hit, based on hard total and fresh-deck composition.
// Soft hands: ace absorbs any single card hit, so bust probability is 0.
// Ignores cards already dealt (no counting) — teaches pure deck probability.
const PLAYER_BUST_PROB: Record<number, number> = {
  12: 16 / 52, 13: 20 / 52, 14: 24 / 52, 15: 28 / 52, 16: 32 / 52,
  17: 36 / 52, 18: 40 / 52, 19: 44 / 52, 20: 48 / 52, 21: 52 / 52,
};

export function getPlayerBustProbability(hand: Card[]): number | null {
  if (hand.length === 0) return null;
  if (isSoft(hand)) return 0;
  const total = calculateHandValue(hand);
  if (total <= 11) return 0;
  if (total > 21) return 1;
  return PLAYER_BUST_PROB[total] ?? null;
}

export function getDealerBustProbability(upcard: Card | undefined): number | null {
  if (!upcard) return null;
  return DEALER_BUST_PROB[upcard.rank] ?? null;
}

export function getBasicStrategyActionLevel1(
  playerTotal: number,
  soft: boolean,
  dealerUpcard: Card,
  playerHand: Card[]
): "hit" | "stand" {
  const code = getBasicStrategyAction(playerHand, dealerUpcard);
  if (code === "H") return "hit";
  if (code === "S") return "stand";
  if (code === "D" || code === "Ds") return "hit";
  // Pair codes: fall back to hard/soft hit-stand evaluation
  if (soft && playerTotal <= 17) return "hit";
  if (playerTotal >= 17) return "stand";
  if (playerTotal <= 11) return "hit";
  if (playerTotal >= 13 && playerTotal <= 16) {
    const dealerVal = dealerUpcard.blackjackValue > 10 ? 10 : dealerUpcard.blackjackValue;
    return dealerVal >= 7 ? "hit" : "stand";
  }
  return "hit";
}

export function isConsecutiveWin(consecutiveCorrect: number): boolean {
  return consecutiveCorrect >= WIN_STREAK;
}

export function getInitialLevel1State(): Level1State {
  return {
    stage: 1,
    phase: "tutor-intro",
    shoe: initShoe(6),
    playerHand: [],
    dealerHand: [],
    correctDecisions: 0,
    totalDecisions: 0,
    consecutiveCorrect: 0,
    lastDecisionCorrect: null,
    sessionComplete: false,
    lastOutcome: null,
    handDecisions: [],
    decisionHandAtAction: null,
    decisionDealerUpcard: null,
    sessionWins: 0,
    sessionLosses: 0,
    dealerBustProbability: null,
    playerBustProbability: null,
    stage2HandsPlayed: 0,
    stage4HandsPlayed: 0,
    stage4IntroShown: false,
    stage5BlockHandsPlayed: 0,
    blockDecisionLog: [],
    lastWrongDecision: null,
    lastWrongDecisionTotal: null,
    lastWrongDecisionSoft: null,
    bustQuizData: null,
    bustQuizStep: 1,
  };
}

export function startNewHand(state: Level1State): Level1State {
  let shoe = state.shoe;
  if (shoe.shoe.length < 15) shoe = initShoe(6);

  let p1: Card, p2: Card, d1: Card, d2: Card;
  ({ card: p1, newState: shoe } = dealCard(shoe));
  ({ card: d1, newState: shoe } = dealCard(shoe));
  ({ card: p2, newState: shoe } = dealCard(shoe));
  ({ card: d2, newState: shoe } = dealCard(shoe));

  const playerHand = [p1, p2];
  if (calculateHandValue(playerHand) === 21) {
    return {
      ...state,
      shoe,
      playerHand,
      dealerHand: [d1, d2],
      phase: "round-over",
      dealerBustProbability: getDealerBustProbability(d1),
      playerBustProbability: null,
      handDecisions: [],
      decisionHandAtAction: null,
      decisionDealerUpcard: null,
      lastOutcome: "win",
      lastDecisionCorrect: null,
      sessionWins: state.sessionWins + 1,
      lastWrongDecision: null,
      lastWrongDecisionTotal: null,
      lastWrongDecisionSoft: null,
      bustQuizData: null,
      bustQuizStep: 1,
    };
  }
  return {
    ...state,
    shoe,
    playerHand,
    dealerHand: [d1, d2],
    phase: "player-turn",
    dealerBustProbability: getDealerBustProbability(d1),
    playerBustProbability: getPlayerBustProbability(playerHand),
    handDecisions: [],
    decisionHandAtAction: null,
    decisionDealerUpcard: null,
    lastOutcome: null,
    lastDecisionCorrect: null,
    lastWrongDecision: null,
    lastWrongDecisionTotal: null,
    lastWrongDecisionSoft: null,
    bustQuizData: null,
    bustQuizStep: 1,
  };
}

function recordDecision(
  state: Level1State,
  action: "hit" | "stand"
): Pick<Level1State,
  | "correctDecisions" | "totalDecisions" | "consecutiveCorrect"
  | "lastDecisionCorrect" | "handDecisions"
  | "decisionHandAtAction" | "decisionDealerUpcard"
  | "lastWrongDecision" | "lastWrongDecisionTotal" | "lastWrongDecisionSoft"
> {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const dealerUpcard = state.dealerHand[0];
  const correct = action === getBasicStrategyActionLevel1(total, soft, dealerUpcard, state.playerHand);
  const decision: HandDecision = {
    action,
    total,
    soft,
    correct,
    dealerUpcard: dealerUpcard?.rank ?? "?",
  };
  const isFirstAction = state.handDecisions.length === 0;

  return {
    // Only count and update streak for first decision per hand
    correctDecisions: isFirstAction ? state.correctDecisions + (correct ? 1 : 0) : state.correctDecisions,
    totalDecisions: isFirstAction ? state.totalDecisions + 1 : state.totalDecisions,
    consecutiveCorrect: isFirstAction ? (correct ? state.consecutiveCorrect + 1 : 0) : state.consecutiveCorrect,
    lastDecisionCorrect: isFirstAction ? correct : state.lastDecisionCorrect,
    handDecisions: [...state.handDecisions, decision],
    // Snapshot the hand state at the moment of first action only
    decisionHandAtAction: isFirstAction ? [...state.playerHand] : state.decisionHandAtAction,
    decisionDealerUpcard: isFirstAction ? dealerUpcard ?? null : state.decisionDealerUpcard,
    lastWrongDecision: isFirstAction && !correct ? action : state.lastWrongDecision,
    lastWrongDecisionTotal: isFirstAction && !correct ? total : state.lastWrongDecisionTotal,
    lastWrongDecisionSoft: isFirstAction && !correct ? soft : state.lastWrongDecisionSoft,
  };
}

export function applyPlayerHit(state: Level1State): Level1State {
  let { shoe } = state;
  let card: Card;
  ({ card, newState: shoe } = dealCard(shoe));
  const playerHand = [...state.playerHand, card];
  const busted = isBust(playerHand);
  const got21 = !busted && calculateHandValue(playerHand) === 21;

  const decisionUpdates = recordDecision(state, "hit");

  return {
    ...state,
    ...decisionUpdates,
    shoe,
    playerHand,
    phase: busted || got21 ? "round-over" : "player-turn",
    playerBustProbability: busted || got21 ? null : getPlayerBustProbability(playerHand),
    lastOutcome: busted ? "loss" : got21 ? "win" : state.lastOutcome,
    sessionLosses: busted ? state.sessionLosses + 1 : state.sessionLosses,
    sessionWins: got21 ? state.sessionWins + 1 : state.sessionWins,
  };
}

export function applyPlayerStand(state: Level1State): Level1State {
  const decisionUpdates = recordDecision(state, "stand");
  return {
    ...state,
    ...decisionUpdates,
    phase: "dealer-turn",
  };
}

export function runDealerPlay(state: Level1State): Level1State {
  let { shoe } = state;
  let dealerHand = [...state.dealerHand];

  while (true) {
    const total = calculateHandValue(dealerHand);
    if (total > 17 || (total === 17 && !isSoft(dealerHand))) break;
    let card: Card;
    ({ card, newState: shoe } = dealCard(shoe));
    dealerHand = [...dealerHand, card];
  }

  const playerTotal = calculateHandValue(state.playerHand);
  const dealerTotal = calculateHandValue(dealerHand);
  const dealerBusted = isBust(dealerHand);

  let lastOutcome: "win" | "loss" | "push";
  if (dealerBusted || playerTotal > dealerTotal) lastOutcome = "win";
  else if (playerTotal < dealerTotal) lastOutcome = "loss";
  else lastOutcome = "push";

  return {
    ...state,
    shoe,
    dealerHand,
    phase: "round-over",
    lastOutcome,
    sessionWins: lastOutcome === "win" ? state.sessionWins + 1 : state.sessionWins,
    sessionLosses: lastOutcome === "loss" ? state.sessionLosses + 1 : state.sessionLosses,
  };
}

function formatDecisionsForContext(decisions: HandDecision[]): string {
  if (decisions.length === 0) return "  No decisions recorded.";
  return decisions.map((d, i) => {
    const typeLabel = d.soft ? "soft" : "hard";
    const correctLabel = d.correct ? "CORRECT" : "INCORRECT";
    return `  ${i + 1}. ${d.action.toUpperCase()} on ${typeLabel} ${d.total} vs dealer ${d.dealerUpcard} — ${correctLabel}`;
  }).join("\n");
}

export function appendBlockHandSummary(
  state: Level1State,
  handNumber: number
): BlockHandSummary[] {
  const summary: BlockHandSummary = {
    handNumber,
    decisions: [...state.handDecisions],
    outcome: state.lastOutcome,
    playerHandAtStart: state.decisionHandAtAction
      ? state.decisionHandAtAction.map(c => c.rank).join(", ")
      : state.playerHand.slice(0, 2).map(c => c.rank).join(", "),
    dealerUpcard: state.dealerHand[0]?.rank ?? "?",
  };
  return [...state.blockDecisionLog, summary];
}

function formatBlockLog(log: BlockHandSummary[]): string {
  if (log.length === 0) return "No hands completed in this block.";
  return log.map((h) => {
    const decisionStr = h.decisions.length === 0
      ? "    Natural blackjack — no decision needed."
      : h.decisions.map((d, i) => {
          const typeLabel = d.soft ? "soft" : "hard";
          const correctLabel = d.correct ? "CORRECT" : "INCORRECT";
          return `    Decision ${i + 1}: ${d.action.toUpperCase()} on ${typeLabel} ${d.total} vs dealer ${d.dealerUpcard} — ${correctLabel}`;
        }).join("\n");
    const outcomeStr = h.outcome ?? "unknown";
    return `  Hand ${h.handNumber} (started: ${h.playerHandAtStart} vs dealer ${h.dealerUpcard}, outcome: ${outcomeStr}):\n${decisionStr}`;
  }).join("\n");
}

export function getLevel1GameContext(state: Level1State): string {
  // Use the snapshotted hand at decision time so the LLM never sees a bust total
  const displayHand = state.decisionHandAtAction ?? state.playerHand;
  const playerTotal = displayHand.length > 0 ? calculateHandValue(displayHand) : null;
  const soft = displayHand.length > 0 ? isSoft(displayHand) : false;

  const dealerUpcardForContext = state.decisionDealerUpcard ?? state.dealerHand[0];
  const dealerBustPct = dealerUpcardForContext
    ? `${Math.round((DEALER_BUST_PROB[dealerUpcardForContext.rank] ?? 0) * 100)}%`
    : "unknown";

  const playerBustPct = playerTotal !== null && playerTotal > 11 && !soft
    ? `${Math.round((PLAYER_BUST_PROB[Math.min(playerTotal, 21)] ?? 0) * 100)}%`
    : (soft ? "0% (soft hand — ace absorbs one card)" : "0% (total too low to bust)");

  const allCorrect = state.handDecisions.length > 0 && state.handDecisions.every(d => d.correct);
  const anyWrong = state.handDecisions.some(d => !d.correct);

  const lines = [
    "Level 1 — Probability & Blackjack",
    `Key probability: ~31% chance any card drawn is a 10-value (10, J, Q, K — 16 out of 52 cards)`,
    `Player hand at decision: ${displayHand.map(c => c.rank).join(", ")}${playerTotal !== null ? ` (total: ${playerTotal}, ${soft ? "soft" : "hard"})` : ""}`,
    `Player bust probability if hitting from that total: ${playerBustPct}`,
    `Dealer upcard: ${dealerUpcardForContext?.rank ?? "none"} (dealer bust probability: ${dealerBustPct})`,
    `Phase: ${state.phase}`,
    `Last first-action decision: ${state.lastDecisionCorrect === null ? "none yet" : state.lastDecisionCorrect ? "CORRECT" : "INCORRECT"}`,
    `All decisions this hand correct: ${allCorrect ? "yes" : anyWrong ? "no" : "no decisions yet"}`,
    `Streak: ${state.consecutiveCorrect} consecutive correct (need ${WIN_STREAK} to pass)`,
    `Session: ${state.correctDecisions}/${state.totalDecisions} correct decisions`,
    ``,
    `Decisions this hand:`,
    formatDecisionsForContext(state.handDecisions),
  ];

  if (state.phase === "tutor-feedback" && state.blockDecisionLog.length > 0) {
    lines.push(``);
    lines.push(`Block summary (last ${state.blockDecisionLog.length} hands):`);
    lines.push(formatBlockLog(state.blockDecisionLog));
  }

  return lines.join("\n");
}

export function getStageIntroContext(stage: 1 | 3 | 4): string {
  if (stage === 1) {
    return [
      "Level 1 — Probability & Blackjack (Stage 1: Introduction)",
      "Task: Welcome the player warmly. Explain that this level teaches probability through blackjack — not rules to memorize, but numbers to reason with. Highlight the single most important fact: a standard 52-card deck has 16 cards worth 10 points (four 10s, four Jacks, four Queens, four Kings), so roughly 31% of the time any card drawn will be a 10-value. Ask the player to keep that 31% in mind for every decision. Keep it to 3–4 sentences.",
    ].join("\n");
  }
  if (stage === 3) {
    return [
      "Level 1 — Probability & Blackjack (Stage 3: Probability Connects to the Dealer)",
      "Task: Help the player see how the 31% ten-value probability connects to the dealer's hidden card. When the dealer shows a weak upcard like 5 or 6, their hole card is most likely a 10-value — giving them roughly a 15 or 16. Since the dealer must hit below 17, they will then draw again into a ~46–62% chance of busting. Explain this probability chain simply. Do not reference specific hands the player has already played. Keep it to 3–4 sentences.",
    ].join("\n");
  }
  return [
    "Level 1 — Probability & Blackjack (Stage 4: Apply the Probabilities)",
    "Task: Give the player a concrete two-number decision framework before their first guided hand. For every hit-or-stand decision, check two probabilities: (1) What is my chance of busting if I hit? (shown in the HUD), and (2) Is the dealer likely to bust without my help? These two numbers should drive every decision — no guessing needed. Keep it to 2–3 sentences.",
  ].join("\n");
}
