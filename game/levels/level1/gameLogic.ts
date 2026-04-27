import type { Card } from "@/lib/cards";
import type { DeckState } from "@/game/deckState";
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
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
export type Level1ResumePhase = "player-turn" | "dealer-turn" | "round-over";
export type Level1CaseType =
  | "dealer_bust_risk"
  | "dealer_bust_risk_exception"
  | "dealer_strong";

export const HANDS_PER_STAGE = 5;
export const STANDARD_DECK_SIZE = 52;
export const TEN_VALUE_CARD_COUNT = 16;

export interface Level1DecisionReview {
  decisionIndex: number;
  studentAction: "hit" | "stand";
  correctAction: "hit" | "stand";
  isCorrect: boolean;
  playerHandAtDecision: Card[];
  playerTotalLabel: string;
  dealerUpcard: string;
  dealerUpcardCard: Card | null;
  assumedDealerTotal: number;
  caseType: Level1CaseType;
  playerBustFraction: string;
  assumedDealerBustFraction: string;
  openingSentence: string;
  reasonSentence: string;
  reflectionQuestion: string;
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
  handDecisions: Level1DecisionReview[];
  pendingFeedbackDecisionIndex: number | null;
  phaseAfterFeedback: Level1ResumePhase | null;
  pendingHitCard: Card | null;
  sessionWins: number;
  sessionLosses: number;
  assumedDealerTotal: number | null;
  playerBustProbability: number | null;
  sessionComplete: boolean;
}

export const UPCARD_ASSUMED_TOTAL: Record<string, number> = {
  "2": 12,
  "3": 13,
  "4": 14,
  "5": 15,
  "6": 16,
  "7": 17,
  "8": 18,
  "9": 19,
  "10": 20,
  J: 20,
  Q: 20,
  K: 20,
  A: 21,
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

export function getAssumedDealerTotal(upcard: Card | undefined): number | null {
  if (!upcard) return null;
  return UPCARD_ASSUMED_TOTAL[upcard.rank] ?? null;
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

function getCardValueForBustCount(rank: string): number {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number.parseInt(rank, 10);
}

function countCardValuesGreaterThanOrEqualTo(threshold: number): number {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return ranks.reduce((count, rank) => {
    const copies = 4;
    return getCardValueForBustCount(rank) >= threshold ? count + copies : count;
  }, 0);
}

export function getAssumedDealerBustFraction(assumedDealerTotal: number | null): string {
  if (assumedDealerTotal === null || assumedDealerTotal >= 17) return "0 out of 52";
  const bustThreshold = 22 - assumedDealerTotal;
  return formatCardFraction(countCardValuesGreaterThanOrEqualTo(bustThreshold));
}

function getBustRiskCategory(bustCount: number): "low" | "medium" | "high" {
  if (bustCount < 16) return "low";
  if (bustCount <= 26) return "medium";
  return "high";
}

export function getLevel1ProbabilityAction(playerHand: Card[], dealerUpcard: Card): "hit" | "stand" {
  const total = calculateHandValue(playerHand);
  const soft = isSoft(playerHand);
  const assumedDealerTotal = getAssumedDealerTotal(dealerUpcard) ?? 20;

  if (assumedDealerTotal <= 16) {
    // Exception: a hard total <= 11 cannot bust from one hit, so hitting is safe.
    // Soft hands always stand — protect the Ace-11 position.
    return !soft && total <= 11 ? "hit" : "stand";
  }
  return total < 17 ? "hit" : "stand";
}

export function getCaseType(playerHand: Card[], assumedDealerTotal: number): Level1CaseType {
  if (assumedDealerTotal <= 16) {
    const total = calculateHandValue(playerHand);
    const soft = isSoft(playerHand);
    return !soft && total <= 11 ? "dealer_bust_risk_exception" : "dealer_bust_risk";
  }
  return "dealer_strong";
}

function buildPlayerTotalLabel(hand: Card[]): string {
  return `${isSoft(hand) ? "soft" : "hard"} ${calculateHandValue(hand)}`;
}

function buildOpeningSentence(
  studentAction: "hit" | "stand",
  correctAction: "hit" | "stand",
  isCorrect: boolean
): string {
  return isCorrect
    ? `Correct — you chose ${studentAction}, and the Level 1 probability rule says ${correctAction}.`
    : `Not quite — you chose ${studentAction}, but the Level 1 probability rule says ${correctAction}.`;
}

function buildReasonSentence(
  caseType: Level1CaseType,
  playerTotalLabel: string,
  dealerUpcard: string,
  assumedDealerTotal: number,
  playerBustFraction: string,
  assumedDealerBustFraction: string
): string {
  if (caseType === "dealer_bust_risk") {
    return (
      `The dealer shows ${dealerUpcard}, so we assume ${assumedDealerTotal}; ` +
      `${assumedDealerBustFraction} cards would bust that assumed total, ` +
      `so standing lets the dealer take the risk.`
    );
  }
  if (caseType === "dealer_bust_risk_exception") {
    return (
      `Your ${playerTotalLabel} cannot bust from one hit, ` +
      `so the rule lets you take one safe card even though the dealer is assumed at ${assumedDealerTotal}.`
    );
  }
  return (
    `The dealer shows ${dealerUpcard}, so we assume ${assumedDealerTotal}; ` +
    `your ${playerTotalLabel} is below that strong assumed total, ` +
    `and ${playerBustFraction} cards would bust you if you hit.`
  );
}

function buildReflectionQuestion(caseType: Level1CaseType): string {
  if (caseType === "dealer_bust_risk") return "What made you decide to stand?";
  if (caseType === "dealer_bust_risk_exception") return "Why is it safe to hit here even though the dealer looks weak?";
  return "What were you thinking about when you made that call?";
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
    pendingFeedbackDecisionIndex: null,
    phaseAfterFeedback: null,
    pendingHitCard: null,
    sessionWins: 0,
    sessionLosses: 0,
    assumedDealerTotal: null,
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
    assumedDealerTotal: getAssumedDealerTotal(d1),
    playerBustProbability: naturalBJ ? null : getPlayerBustProbability(playerHand),
    handDecisions: [],
    pendingFeedbackDecisionIndex: null,
    phaseAfterFeedback: null,
    pendingHitCard: null,
    lastOutcome: naturalBJ ? "win" : null,
    lastDecisionCorrect: null,
    sessionWins: naturalBJ ? state.sessionWins + 1 : state.sessionWins,
  };
}

function recordDecision(state: Level1State, action: "hit" | "stand"): Partial<Level1State> {
  const dealerUpcard = state.dealerHand[0];
  const assumedDealerTotal = getAssumedDealerTotal(dealerUpcard) ?? 20;
  const correctAction = getLevel1ProbabilityAction(state.playerHand, dealerUpcard);
  const isCorrect = action === correctAction;
  const decisionIndex = state.handDecisions.length;
  const playerBustFraction = getPlayerBustFraction(state.playerHand);
  const assumedDealerBustFraction = getAssumedDealerBustFraction(assumedDealerTotal);
  const caseType = getCaseType(state.playerHand, assumedDealerTotal);
  const playerTotalLabel = buildPlayerTotalLabel(state.playerHand);
  const dealerUpcardRank = dealerUpcard?.rank ?? "?";

  const review: Level1DecisionReview = {
    decisionIndex,
    studentAction: action,
    correctAction,
    isCorrect,
    playerHandAtDecision: [...state.playerHand],
    playerTotalLabel,
    dealerUpcard: dealerUpcardRank,
    dealerUpcardCard: dealerUpcard ?? null,
    assumedDealerTotal,
    caseType,
    playerBustFraction,
    assumedDealerBustFraction,
    openingSentence: buildOpeningSentence(action, correctAction, isCorrect),
    reasonSentence: buildReasonSentence(caseType, playerTotalLabel, dealerUpcardRank, assumedDealerTotal, playerBustFraction, assumedDealerBustFraction),
    reflectionQuestion: buildReflectionQuestion(caseType),
  };

  return {
    correctDecisions: state.correctDecisions + (isCorrect ? 1 : 0),
    totalDecisions: state.totalDecisions + 1,
    lastDecisionCorrect: isCorrect,
    handDecisions: [...state.handDecisions, review],
    pendingFeedbackDecisionIndex: decisionIndex,
  };
}

export function applyPlayerHit(state: Level1State): Level1State {
  let { shoe } = state;
  const hitDeal = dealCard(shoe);
  const card = hitDeal.card;
  shoe = hitDeal.newState;
  const futureHand = [...state.playerHand, card];
  const busted = isBust(futureHand);
  const got21 = !busted && calculateHandValue(futureHand) === 21;
  const phaseAfterFeedback: Level1ResumePhase = busted || got21 ? "round-over" : "player-turn";

  // Card is held in pendingHitCard — applied to playerHand after tutor feedback is dismissed
  return {
    ...state,
    ...recordDecision(state, "hit"),
    shoe,
    pendingHitCard: card,
    phase: "tutor-feedback",
    phaseAfterFeedback,
  };
}

export function applyPendingHitCard(state: Level1State): Level1State {
  if (!state.pendingHitCard) return state;
  const card = state.pendingHitCard;
  const playerHand = [...state.playerHand, card];
  const busted = isBust(playerHand);
  const got21 = !busted && calculateHandValue(playerHand) === 21;
  return {
    ...state,
    playerHand,
    pendingHitCard: null,
    playerBustProbability: busted || got21 ? null : getPlayerBustProbability(playerHand),
    lastOutcome: busted ? "loss" : got21 ? "win" : state.lastOutcome,
    sessionLosses: busted ? state.sessionLosses + 1 : state.sessionLosses,
    sessionWins: got21 ? state.sessionWins + 1 : state.sessionWins,
  };
}

export function applyPlayerStand(state: Level1State): Level1State {
  return {
    ...state,
    ...recordDecision(state, "stand"),
    phase: "tutor-feedback",
    phaseAfterFeedback: "dealer-turn",
  };
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

function getReviewedDecision(state: Level1State): Level1DecisionReview | undefined {
  if (state.pendingFeedbackDecisionIndex !== null) {
    return state.handDecisions.find((d) => d.decisionIndex === state.pendingFeedbackDecisionIndex);
  }
  return state.handDecisions.at(-1);
}

export function getHandFeedbackContext(state: Level1State): string {
  const d = getReviewedDecision(state);
  if (!d) return "message_type: decision_feedback\nno_decision: true";

  return [
    "message_type: decision_feedback",
    `delivered_opening: ${d.openingSentence}`,
    `case_type: ${d.caseType}`,
    `must_use_reason: ${d.reasonSentence}`,
    `must_ask_question: ${d.reflectionQuestion}`,
    `player_total_label: ${d.playerTotalLabel}`,
    `dealer_upcard: ${d.dealerUpcard}`,
    `assumed_dealer_total: ${d.assumedDealerTotal}`,
    `player_bust_fraction_if_hit: ${d.playerBustFraction}`,
    `assumed_dealer_bust_fraction_if_forced_to_hit: ${d.assumedDealerBustFraction}`,
  ].join("\n");
}

export function getHintContext(state: Level1State): string {
  const upcard = state.dealerHand[0];
  const assumedDealerTotal = getAssumedDealerTotal(upcard) ?? 20;
  const caseType = getCaseType(state.playerHand, assumedDealerTotal);
  const level1ProbabilityAction = upcard ? getLevel1ProbabilityAction(state.playerHand, upcard) : "stand";
  const playerBustFraction = getPlayerBustFraction(state.playerHand);
  const assumedDealerBustFraction = getAssumedDealerBustFraction(assumedDealerTotal);

  return [
    "message_type: hint",
    `assumed_dealer_total: ${assumedDealerTotal}`,
    `case_type: ${caseType}`,
    `level1_probability_action: ${level1ProbabilityAction}`,
    `player_bust_fraction_if_hit: ${playerBustFraction}`,
    `assumed_dealer_bust_fraction_if_forced_to_hit: ${assumedDealerBustFraction}`,
  ].join("\n");
}

export function getStageQuestionContext(state: Level1State): string {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const upcard = state.dealerHand[0];
  const assumedDealerTotal = getAssumedDealerTotal(upcard);
  const bustCount = getPlayerBustCountFromTotal(total, soft);
  const bustFraction = formatCardFraction(bustCount);
  const assumedDealerBustFraction = getAssumedDealerBustFraction(assumedDealerTotal);
  const category = getBustRiskCategory(bustCount);
  const level1ProbabilityAction = upcard ? getLevel1ProbabilityAction(state.playerHand, upcard) : "stand";
  const comparison = assumedDealerTotal === null
    ? "unknown"
    : total > assumedDealerTotal
      ? "above"
      : total < assumedDealerTotal
        ? "below"
        : "tied";

  if (state.stage === 1) {
    return [
      "message_type: stage_question",
      "stage: 1",
      `dealer_upcard: ${upcard?.rank}`,
      `correct_assumed_dealer_total_hidden: ${assumedDealerTotal ?? "not_available"}`,
      "student_prompt: Ask what assumed dealer total the upcard plus 10 makes.",
      "response_style: 1 or 2 short conversational sentences; do not reveal the answers",
    ].join("\n");
  }

  if (state.stage === 2) {
    return [
      "message_type: stage_question",
      "stage: 2",
      `player_total: ${soft ? "soft" : "hard"} ${total}`,
      `assumed_dealer_total_hidden: ${assumedDealerTotal ?? "not_available"}`,
      `comparison_hidden: ${comparison}`,
      "student_prompt: Ask whether their total is above, below, or tied with the assumed dealer total.",
      "response_style: 1 short conversational sentence; do not reveal the answer yet",
    ].join("\n");
  }

  if (state.stage === 3) {
    return [
      "message_type: stage_question",
      "stage: 3",
      `dealer_upcard: ${upcard?.rank}`,
      `player_total: ${soft ? "soft" : "hard"} ${total}`,
      `assumed_dealer_total: ${assumedDealerTotal ?? "not_available"}`,
      `player_bust_fraction_hidden: ${bustFraction}`,
      `player_bust_category_hidden: ${category}`,
      `assumed_dealer_bust_fraction_if_forced_to_hit_hidden: ${assumedDealerBustFraction}`,
      `level1_probability_action_hidden: ${level1ProbabilityAction}`,
      "student_prompt: Ask what their bust risk would be if they hit, and whether it is worth closing the gap.",
      "response_style: 1 short conversational sentence; do not reveal the fraction yet",
    ].join("\n");
  }

  return "";
}

export function getStudentAnswerContext(state: Level1State, answer: string): string {
  const total = calculateHandValue(state.playerHand);
  const soft = isSoft(state.playerHand);
  const upcard = state.dealerHand[0];
  const assumedDealerTotal = getAssumedDealerTotal(upcard);
  const bustCount = getPlayerBustCountFromTotal(total, soft);
  const bustFraction = formatCardFraction(bustCount);
  const assumedDealerBustFraction = getAssumedDealerBustFraction(assumedDealerTotal);
  const lower = answer.toLowerCase();
  const comparison = assumedDealerTotal === null
    ? "unknown"
    : total > assumedDealerTotal
      ? "above"
      : total < assumedDealerTotal
        ? "below"
        : "tied";
  const level1ProbabilityAction = upcard ? getLevel1ProbabilityAction(state.playerHand, upcard) : "stand";

  if (state.stage === 1) {
    const guessedCorrect = assumedDealerTotal !== null && lower.includes(String(assumedDealerTotal));
    return [
      "message_type: stage_answer",
      "stage: 1",
      `student_answer: ${JSON.stringify(answer)}`,
      `dealer_upcard: ${upcard?.rank}`,
      `answer_result: ${guessedCorrect ? "correct" : "incorrect"}`,
      `correct_assumed_dealer_total: ${assumedDealerTotal ?? "not_available"}`,
      "response_style: confirm or correct in 1 or 2 conversational sentences; do not advise hit or stand yet",
    ].join("\n");
  }

  if (state.stage === 2) {
    const guessedCorrect = lower.includes(comparison);
    return [
      "message_type: stage_answer",
      "stage: 2",
      `student_answer: ${JSON.stringify(answer)}`,
      `answer_result: ${guessedCorrect ? "correct" : "incorrect"}`,
      `player_total: ${soft ? "soft" : "hard"} ${total}`,
      `assumed_dealer_total: ${assumedDealerTotal ?? "not_available"}`,
      `correct_comparison: ${comparison}`,
      "response_style: confirm or correct in 1 sentence, then connect the comparison to the probability rule",
    ].join("\n");
  }

  if (state.stage === 3) {
    return [
      "message_type: stage_answer",
      "stage: 3",
      `student_answer: ${JSON.stringify(answer)}`,
      `player_total: ${soft ? "soft" : "hard"} ${total}`,
      `assumed_dealer_total: ${assumedDealerTotal ?? "not_available"}`,
      `player_bust_fraction_if_hit: ${bustFraction}`,
      `player_bust_category: ${getBustRiskCategory(bustCount)}`,
      `assumed_dealer_bust_fraction_if_forced_to_hit: ${assumedDealerBustFraction}`,
      `level1_probability_action: ${level1ProbabilityAction}`,
      "response_style: acknowledge their reasoning in 1 sentence, reveal the key fraction, then explain why the probability rule says hit or stand",
    ].join("\n");
  }

  const d = getReviewedDecision(state);
  const factLines = d ? [
    `case_type: ${d.caseType}`,
    `player_total_label: ${d.playerTotalLabel}`,
    `dealer_upcard: ${d.dealerUpcard}`,
    `assumed_dealer_total: ${d.assumedDealerTotal}`,
    `level1_probability_action: ${d.correctAction}`,
    `player_bust_fraction_if_hit: ${d.playerBustFraction}`,
    `assumed_dealer_bust_fraction_if_forced_to_hit: ${d.assumedDealerBustFraction}`,
  ] : [];

  return [
    "message_type: student_question",
    `student_question: ${JSON.stringify(answer)}`,
    ...factLines,
    "response_style: answer in 2 short conversational sentences; do not introduce new concepts",
  ].join("\n");
}

export function getFeedbackReflectionContext(state: Level1State, answer: string): string {
  const d = getReviewedDecision(state);
  if (!d) {
    return [
      "message_type: feedback_reflection_answer",
      `student_answer: ${JSON.stringify(answer)}`,
      "response_style: acknowledge briefly in 2 sentences; no follow-up question",
    ].join("\n");
  }

  return [
    "message_type: feedback_reflection_answer",
    `student_answer: ${JSON.stringify(answer)}`,
    `case_type: ${d.caseType}`,
    `must_use_reason: ${d.reasonSentence}`,
    `player_total_label: ${d.playerTotalLabel}`,
    `dealer_upcard: ${d.dealerUpcard}`,
    `assumed_dealer_total: ${d.assumedDealerTotal}`,
    `player_bust_fraction_if_hit: ${d.playerBustFraction}`,
    `assumed_dealer_bust_fraction_if_forced_to_hit: ${d.assumedDealerBustFraction}`,
  ].join("\n");
}

export function getStudentQuestionContext(state: Level1State, question: string): string {
  const d = getReviewedDecision(state);
  const factLines = d ? [
    `case_type: ${d.caseType}`,
    `player_total_label: ${d.playerTotalLabel}`,
    `dealer_upcard: ${d.dealerUpcard}`,
    `assumed_dealer_total: ${d.assumedDealerTotal}`,
    `level1_probability_action: ${d.correctAction}`,
    `player_bust_fraction_if_hit: ${d.playerBustFraction}`,
    `assumed_dealer_bust_fraction_if_forced_to_hit: ${d.assumedDealerBustFraction}`,
  ] : [];

  return [
    "message_type: student_question",
    `student_question: ${JSON.stringify(question)}`,
    ...factLines,
    "response_style: answer in 2 short conversational sentences; do not introduce new concepts",
  ].join("\n");
}

export function getStageAdvanceContext(state: Level1State): string {
  const concepts: Record<Level1Stage, string> = {
    0: "blackjack card values, Hit or Stand, and the assume-10 rule",
    1: "finding the dealer's assumed total from the upcard plus 10",
    2: "comparing your total with the assumed dealer total",
    3: "weighing the gap against bust risk when deciding whether to hit",
    4: "separating decision quality from hand outcomes",
  };
  return [
    "message_type: stage_advance",
    `stage: ${state.stage}`,
    `hands_played: ${state.handsInStage}`,
    `session_accuracy: ${state.correctDecisions}/${state.totalDecisions}`,
    `concept_covered: ${concepts[state.stage]}`,
    "response_style: acknowledge progress in 1 sentence, then say: Type yes to move on, or more to keep practicing.",
  ].join("\n");
}

export function getStageIntroContext(stage: Level1Stage): string {
  const intros: Record<Level1Stage, string> = {
    0: [
      "message_type: stage_intro",
      "stage: 0",
      "student_goal: Learn card values, Hit or Stand, and Level 1 basic probability.",
      "teaching_points: Goal: get closer to 21 than the dealer without going over. Card values: 2 through 10 are worth their printed number; Jack, Queen, and King are each worth exactly 10; Ace is worth 1 or 11. The dealer shows one face-up card. In Level 1, always assume the dealer's hidden card is worth 10. Add 10 to the upcard to get the assumed dealer total.",
      "forbidden: Do not state the value of a named card incorrectly (e.g. never say a King is worth 13). Do not invent card totals from unstated hidden cards.",
      "flow_note: After each decision, the tutor asks one question and the student answers before the next hand.",
      "response_style: 2 short natural teaching sentences; do not ask for an action yet",
    ].join("\n"),
    1: [
      "message_type: stage_intro",
      "stage: 1",
      "student_goal: Find the assumed dealer total.",
      "teaching_points: Always assume the dealer's hidden card is worth 10. Add 10 to the visible upcard to get the dealer's assumed total.",
      "response_style: 2 short conversational sentences",
    ].join("\n"),
    2: [
      "message_type: stage_intro",
      "stage: 2",
      "student_goal: Compare your total with the assumed dealer total.",
      "teaching_points: Compare your total to the assumed dealer total before choosing. If the dealer is assumed to have 17 through 21, try to reach 18 or higher, then stop.",
      "response_style: 2 short conversational sentences",
    ].join("\n"),
    3: [
      "message_type: stage_intro",
      "stage: 3",
      "student_goal: Weigh the gap against bust risk.",
      "teaching_points: When you are behind and need to hit, check how many of the 52 cards would bust you. If the assumed dealer total is 12 through 16, the dealer is assumed to need another card, so standing can let the dealer take the risk.",
      "response_style: 2 short conversational sentences",
    ].join("\n"),
    4: [
      "message_type: stage_intro",
      "stage: 4",
      "student_goal: Separate decision quality from the hand result.",
      "teaching_points: A decision based on the assume-10 probability rule can still lose. The hidden card assumption may be wrong, but the goal is making consistent choices from the information you can see.",
      "response_style: 2 short conversational sentences",
    ].join("\n"),
  };
  return intros[stage];
}
