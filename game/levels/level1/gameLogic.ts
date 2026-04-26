import type { Card } from "@/lib/cards";
import type { DeckState } from "@/game/deckState";
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
import { evaluateDecision } from "@/game/basicStrategy";
import { initShoe, dealCard } from "@/game/deckState";

export type Level1Stage = 0 | 1 | 2 | 3 | 4;
export type Level1Phase =
  | "tutor-intro"
  | "player-turn"
  | "dealer-turn"
  | "round-over"
  | "tutor-feedback"
  | "tutor-advance"
  | "session-over";

export const HANDS_PER_STAGE = 5;
export const STANDARD_DECK_SIZE = 52;
export const TEN_VALUE_CARD_COUNT = 16;

export interface HandDecision {
  action: "hit" | "stand";
  total: number;
  soft: boolean;
  correct: boolean;
  dealerUpcard: string;
  basicStrategyAction: "hit" | "stand";
}

export interface Level1State {
  stage: Level1Stage;
  phase: Level1Phase;
  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];
  handId: number;
  handsInStage: number;
  correctDecisions: number;
  totalDecisions: number;
  lastDecisionCorrect: boolean | null;
  lastOutcome: "win" | "loss" | "push" | null;
  handDecisions: HandDecision[];
  decisionHandAtAction: Card[] | null;
  decisionDealerUpcard: Card | null;
  sessionWins: number;
  sessionLosses: number;
  dealerBustProbability: number | null;
  playerBustProbability: number | null;
  sessionComplete: boolean;
}

export const DEALER_BUST_PROB: Record<string, number> = {
  "2": 0.353, "3": 0.376, "4": 0.403, "5": 0.429, "6": 0.423,
  "7": 0.262, "8": 0.244, "9": 0.230, "10": 0.214,
  "J": 0.214, "Q": 0.214, "K": 0.214, "A": 0.117,
};

export const PLAYER_BUST_PROB: Record<number, number> = {
  12: 16 / 52, 13: 20 / 52, 14: 24 / 52, 15: 28 / 52, 16: 32 / 52,
  17: 36 / 52, 18: 40 / 52, 19: 44 / 52, 20: 48 / 52, 21: 52 / 52,
};

export const PLAYER_BUST_COUNTS: Record<number, number> = {
  12: 16, 13: 20, 14: 24, 15: 28, 16: 32,
  17: 36, 18: 40, 19: 44, 20: 48, 21: 52,
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

export function formatCardFraction(count: number): string {
  return `${count} out of ${STANDARD_DECK_SIZE}`;
}

function getPlayerBustCountFromTotal(total: number, soft: boolean): number {
  if (soft || total <= 11) return 0;
  if (total > 21) return STANDARD_DECK_SIZE;
  return PLAYER_BUST_COUNTS[total] ?? 0;
}

export function getPlayerBustFraction(hand: Card[]): string {
  if (hand.length === 0) return "N/A";
  return formatCardFraction(getPlayerBustCountFromTotal(calculateHandValue(hand), isSoft(hand)));
}

function getDealerBustFraction(upcard: Card | undefined): string {
  if (!upcard) return "N/A";
  const count = Math.round((DEALER_BUST_PROB[upcard.rank] ?? 0) * STANDARD_DECK_SIZE);
  return formatCardFraction(count);
}

function getBustRiskCategory(bustCount: number): "low" | "medium" | "high" {
  if (bustCount < 16) return "low";
  if (bustCount <= 26) return "medium";
  return "high";
}

export function getInitialLevel1State(): Level1State {
  return {
    stage: 0,
    phase: "tutor-intro",
    shoe: initShoe(6),
    playerHand: [],
    dealerHand: [],
    handId: 0,
    handsInStage: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    lastDecisionCorrect: null,
    lastOutcome: null,
    handDecisions: [],
    decisionHandAtAction: null,
    decisionDealerUpcard: null,
    sessionWins: 0,
    sessionLosses: 0,
    dealerBustProbability: null,
    playerBustProbability: null,
    sessionComplete: false,
  };
}

export function startNewHand(state: Level1State): Level1State {
  let shoe = state.shoe;
  if (shoe.shoe.length < 15) shoe = initShoe(6);

  const firstPlayerDeal = dealCard(shoe);
  const p1 = firstPlayerDeal.card;
  shoe = firstPlayerDeal.newState;
  const firstDealerDeal = dealCard(shoe);
  const d1 = firstDealerDeal.card;
  shoe = firstDealerDeal.newState;
  const secondPlayerDeal = dealCard(shoe);
  const p2 = secondPlayerDeal.card;
  shoe = secondPlayerDeal.newState;
  const secondDealerDeal = dealCard(shoe);
  const d2 = secondDealerDeal.card;
  shoe = secondDealerDeal.newState;

  const playerHand = [p1, p2];
  const naturalBJ = calculateHandValue(playerHand) === 21;

  return {
    ...state,
    shoe,
    playerHand,
    dealerHand: [d1, d2],
    handId: state.handId + 1,
    phase: naturalBJ ? "round-over" : "player-turn",
    dealerBustProbability: getDealerBustProbability(d1),
    playerBustProbability: naturalBJ ? null : getPlayerBustProbability(playerHand),
    handDecisions: [],
    decisionHandAtAction: null,
    decisionDealerUpcard: null,
    lastOutcome: naturalBJ ? "win" : null,
    lastDecisionCorrect: null,
    sessionWins: naturalBJ ? state.sessionWins + 1 : state.sessionWins,
  };
}

function getBasicStrategyHitStand(playerHand: Card[], dealerUpcard: Card): "hit" | "stand" {
  const hitResult = evaluateDecision(playerHand, dealerUpcard, "hit", false);
  if (hitResult.correct) return "hit";
  const standResult = evaluateDecision(playerHand, dealerUpcard, "stand", false);
  if (standResult.correct) return "stand";
  return "hit";
}

function recordDecision(state: Level1State, action: "hit" | "stand"): Partial<Level1State> {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const dealerUpcard = state.dealerHand[0];
  const basicStrategyAction = getBasicStrategyHitStand(state.playerHand, dealerUpcard);
  const correct = action === basicStrategyAction;
  const isFirst = state.handDecisions.length === 0;
  const decision: HandDecision = {
    action,
    total,
    soft,
    correct,
    dealerUpcard: dealerUpcard?.rank ?? "?",
    basicStrategyAction,
  };

  return {
    correctDecisions: isFirst ? state.correctDecisions + (correct ? 1 : 0) : state.correctDecisions,
    totalDecisions: isFirst ? state.totalDecisions + 1 : state.totalDecisions,
    lastDecisionCorrect: isFirst ? correct : state.lastDecisionCorrect,
    handDecisions: [...state.handDecisions, decision],
    decisionHandAtAction: isFirst ? [...state.playerHand] : state.decisionHandAtAction,
    decisionDealerUpcard: isFirst ? (dealerUpcard ?? null) : state.decisionDealerUpcard,
  };
}

export function applyPlayerHit(state: Level1State): Level1State {
  let { shoe } = state;
  const hitDeal = dealCard(shoe);
  const card = hitDeal.card;
  shoe = hitDeal.newState;
  const playerHand = [...state.playerHand, card];
  const busted = isBust(playerHand);
  const got21 = !busted && calculateHandValue(playerHand) === 21;

  return {
    ...state,
    ...recordDecision(state, "hit"),
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
  return { ...state, ...recordDecision(state, "stand"), phase: "dealer-turn" };
}

export function runDealerPlay(state: Level1State): Level1State {
  let { shoe } = state;
  let dealerHand = [...state.dealerHand];

  while (true) {
    const total = calculateHandValue(dealerHand);
    if (total > 17 || (total === 17 && !isSoft(dealerHand))) break;
    const dealerDeal = dealCard(shoe);
    const card = dealerDeal.card;
    shoe = dealerDeal.newState;
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

// ── Context builders — app computes all numbers, LLM only formats ──────────────

export function getHandFeedbackContext(state: Level1State): string {
  const displayHand = state.decisionHandAtAction ?? state.playerHand;
  const playerTotal = displayHand.length > 0 ? calculateHandValue(displayHand) : null;
  const soft = displayHand.length > 0 ? isSoft(displayHand) : false;
  const upcard = state.decisionDealerUpcard ?? state.dealerHand[0];
  const dealerIsStrong = upcard ? upcard.blackjackValue >= 7 : null;
  const playerBustFraction = displayHand.length > 0 ? getPlayerBustFraction(displayHand) : "N/A";
  const dealerBustFraction = getDealerBustFraction(upcard);
  const firstDecision = state.handDecisions[0];
  const wasCorrect = firstDecision?.correct ?? null;
  const basicStrategyAction = firstDecision?.basicStrategyAction ?? (
    upcard && displayHand.length > 0 ? getBasicStrategyHitStand(displayHand, upcard) : null
  );

  return [
    `Stage: ${state.stage}`,
    `Decision correctness: ${wasCorrect === null ? "N/A (natural blackjack)" : wasCorrect ? "CORRECT" : "INCORRECT"}`,
    `Player hand at decision: ${displayHand.map(c => c.rank).join(", ")} (total: ${playerTotal ?? "N/A"}, ${soft ? "soft" : "hard"})`,
    `Player action: ${firstDecision?.action ?? "none"}`,
    `Basic strategy action: ${basicStrategyAction ?? "N/A"}`,
    `Player bust fraction if hitting: ${playerBustFraction} cards would bust this hand`,
    `Dealer upcard: ${upcard?.rank ?? "none"} (${dealerIsStrong !== null ? (dealerIsStrong ? "STRONG: 7-A" : "WEAK: 2-6") : "unknown"})`,
    `Dealer bust fraction: ${dealerBustFraction} chance the dealer busts from this upcard`,
    `Hand outcome: ${state.lastOutcome ?? "unknown"}`,
    `Session accuracy: ${state.correctDecisions}/${state.totalDecisions} correct`,
    `Tutor response requirement: Write exactly 4 sentences. Sentence 1 must be "Decision: ${wasCorrect ? "CORRECT" : "INCORRECT"} - you chose ${firstDecision?.action ?? "none"}; basic strategy says ${basicStrategyAction ?? "N/A"}." Sentence 4 must be exactly one question for the student.`,
  ].join("\n");
}

export function getStageQuestionContext(state: Level1State): string {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const upcard = state.dealerHand[0];
  const dealerIsStrong = upcard ? upcard.blackjackValue >= 7 : true;
  const bustCount = getPlayerBustCountFromTotal(total, soft);
  const bustFraction = formatCardFraction(bustCount);
  const dealerBustFraction = getDealerBustFraction(upcard);
  const category = getBustRiskCategory(bustCount);

  if (state.stage === 1) {
    return [
      `[STAGE_1_QUESTION] New hand. Correct total: ${total}${soft ? " soft" : ""}. Dealer upcard: ${upcard?.rank} (${dealerIsStrong ? "STRONG: 7-A" : "WEAK: 2-6"}).`,
      `Task: Ask the student two questions: "What is your hand total?" then "Is the dealer showing a strong (7-A) or weak (2-6) card?" Do not reveal answers. 2-3 friendly sentences.`,
    ].join("\n");
  }

  if (state.stage === 2) {
    return [
      `[STAGE_2_QUESTION] New hand. Player: ${state.playerHand.map(c => c.rank).join(", ")} (total: ${total}${soft ? " soft" : ""}). Actual bust fraction: ${bustFraction} cards would bust this hand (${category}) - do not reveal yet.`,
      `Task: Ask the student to estimate their bust risk: "Before I show you the exact count, estimate your bust risk if you hit - low, medium, or high?" 1-2 sentences.`,
    ].join("\n");
  }

  if (state.stage === 3) {
    return [
      `[STAGE_3_QUESTION] New hand. Dealer upcard: ${upcard?.rank} (${dealerIsStrong ? "STRONG" : "WEAK"}, dealer bust fraction: ${dealerBustFraction}) - do not reveal the fraction yet.`,
      `Task: Ask: "The dealer is showing a ${upcard?.rank}. Would you call this a strong or weak dealer card?" 1-2 sentences.`,
    ].join("\n");
  }

  return "";
}

export function getStudentAnswerContext(state: Level1State, answer: string): string {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const upcard = state.dealerHand[0];
  const dealerIsStrong = upcard ? upcard.blackjackValue >= 7 : true;
  const bustCount = getPlayerBustCountFromTotal(total, soft);
  const bustFraction = formatCardFraction(bustCount);
  const dealerBustFraction = getDealerBustFraction(upcard);
  const lower = answer.toLowerCase();

  if (state.stage === 1) {
    return [
      `[STAGE_1_ANSWER] Student answered: "${answer}"`,
      `Correct total: ${total}${soft ? " (soft)" : ""}. Correct dealer type: ${dealerIsStrong ? "strong" : "weak"} (${upcard?.rank}).`,
      `Task: In 1-2 sentences, confirm both the total and dealer classification. Gently correct any errors. Do not advise whether to hit or stand yet.`,
    ].join("\n");
  }

  if (state.stage === 2) {
    const actualCategory = getBustRiskCategory(bustCount);
    const guessedCorrect = lower.includes(actualCategory);
    return [
      `[STAGE_2_ANSWER] Student estimated: "${answer}". Actual bust fraction: ${bustFraction} cards would bust this hand (${actualCategory}). Estimate was ${guessedCorrect ? "CORRECT" : "INCORRECT"}.`,
      `Task: Confirm or correct their estimate in 1 sentence. Reveal the actual fraction (${bustFraction}). Then ask them to decide: hit or stand?`,
    ].join("\n");
  }

  if (state.stage === 3) {
    const guessedStrong = lower.includes("strong");
    const guessedWeak = lower.includes("weak");
    const correct = (dealerIsStrong && guessedStrong) || (!dealerIsStrong && guessedWeak);
    return [
      `[STAGE_3_ANSWER] Student classified dealer as: "${answer}". Correct: ${dealerIsStrong ? "STRONG (7-A)" : "WEAK (2-6)"}. Answer was ${correct ? "CORRECT" : "INCORRECT"}.`,
      `Actual dealer bust fraction: ${dealerBustFraction}.`,
      `Task: Confirm or correct in 1 sentence. Reveal the dealer bust fraction (${dealerBustFraction}). Explain in 1 sentence what this means for the player's decision.`,
    ].join("\n");
  }

  return `[STUDENT_QUESTION] "${answer}"\n${getHandFeedbackContext(state)}`;
}

export function getStageAdvanceContext(state: Level1State): string {
  const concepts: Record<Level1Stage, string> = {
    0: "blackjack card values and the hit/stand decision",
    1: "how your hand total and the dealer's card guide decisions",
    2: "bust probability and estimating risk before hitting",
    3: "dealer bust probability and how it changes when to stand",
    4: "separating decision quality from hand outcomes",
  };
  return [
    `[STAGE_ADVANCE] Stage ${state.stage} check-in. Hands played: ${state.handsInStage}. Accuracy: ${state.correctDecisions}/${state.totalDecisions}.`,
    `Concept covered: ${concepts[state.stage]}`,
    `Task: Acknowledge their work on this concept in 1 sentence. Then ask: "Do you feel comfortable with this? Type 'yes' to move on to the next concept, or 'more' to keep practicing." 2-3 sentences total.`,
  ].join("\n");
}

export function getStageIntroContext(stage: Level1Stage): string {
  const intros: Record<Level1Stage, string> = {
    0: [
      "[STAGE_INTRO] Stage 0: Blackjack Basics.",
      "Teach these rules simply: number cards = face value, face cards (J/Q/K) = 10, Ace = 1 or 11. Goal: beat the dealer's total without going over 21 (busting). Player can Hit (take a card) or Stand (stop). The dealer shows one card face-up; use it as a clue.",
      "Say that after each decision, the tutor will ask one question and the student must answer before the next hand. Do not ask what the student wants to do yet. 3-4 warm sentences for a complete beginner. End by saying a hand is about to be dealt.",
    ].join("\n"),
    1: [
      "[STAGE_INTRO] Stage 1: Your Hand vs. The Dealer.",
      "Introduce: decisions depend on BOTH the player's total AND the dealer's visible card. Dealers showing 7 through Ace have strong hands (less likely to bust). Dealers showing 2 through 6 are weak (more likely to bust — they must keep drawing). Tell the student you will ask about their total and the dealer's type each round.",
      "3-4 sentences. Plain text only.",
    ].join("\n"),
    2: [
      "[STAGE_INTRO] Stage 2: Bust Probability.",
      "Introduce bust risk as a fraction of cards. Key fact: 16 out of 52 cards are 10-value (10, J, Q, K). This makes hitting on a stiff total (12-16) risky. Tell the student you will ask them to estimate their bust risk before revealing the exact fraction each round.",
      "3-4 sentences. Plain text only.",
    ].join("\n"),
    3: [
      "[STAGE_INTRO] Stage 3: Dealer Bust Probability.",
      "Introduce: the dealer has a bust risk too. Weak dealer cards (2-6) force the dealer to keep drawing, giving them more bust cards out of 52 than strong dealer cards usually have. Sometimes the right move is to stand and let the dealer bust rather than risk busting yourself. Tell the student you will ask them to classify the dealer card each round before showing the fraction.",
      "3-4 sentences. Plain text only.",
    ].join("\n"),
    4: [
      "[STAGE_INTRO] Stage 4: Decision Quality vs. Results.",
      "Introduce the key idea: a correct decision can still lose. An incorrect decision can still win. What matters is making the decision that wins more often over many hands — not just this one. Tell the student you will call out their decision quality and the result separately after each hand.",
      "3-4 sentences. Plain text only.",
    ].join("\n"),
  };
  return intros[stage];
}
