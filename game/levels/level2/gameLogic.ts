import type { Card } from "@/lib/cards";
import type { DeckState } from "@/game/deckState";
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
import { initShoe, dealCard } from "@/game/deckState";

export type Level2Stage = 1 | 2 | 3 | 4;
export type Level2Phase =
  | "tutor-intro"
  | "player-turn"
  | "dealer-turn"
  | "round-over"
  | "tutor-feedback"
  | "session-over";

export type CountDirection = "positive" | "negative" | "neutral";

export const STAGE2_HAND_COUNT = 3;
export const STAGE3_STREAK_NEEDED = 3;
export const STAGE4_STREAK_NEEDED = 5;
export const STAGE4_BLOCK_SIZE = 5;

export const HI_LO_VALUES: Record<string, number> = {
  "2": 1, "3": 1, "4": 1, "5": 1, "6": 1,
  "7": 0, "8": 0, "9": 0,
  "10": -1, "J": -1, "Q": -1, "K": -1, "A": -1,
};

const DEALER_BUST_PROB: Record<string, number> = {
  "2": 0.353, "3": 0.376, "4": 0.403, "5": 0.429, "6": 0.423,
  "7": 0.262, "8": 0.244, "9": 0.230, "10": 0.214,
  "J": 0.214, "Q": 0.214, "K": 0.214, "A": 0.117,
};

export interface Level2State {
  stage: Level2Stage;
  phase: Level2Phase;
  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];

  runningCount: number;
  handStartCount: number;
  handRunningCount: number;
  cardCountValues: number[];
  currentCardIndex: number;

  playerDirectionInput: "positive" | "negative" | null;
  lastInputCorrect: boolean | null;
  correctInputs: number;
  totalInputs: number;
  consecutiveCorrect: number;
  sessionComplete: boolean;

  stage2HandsPlayed: number;
  stage3HandsCorrect: number;
  stage4BlockHandsPlayed: number;

  correctDecisions: number;
  totalDecisions: number;
  lastDecisionCorrect: boolean | null;
  lastOutcome: "win" | "loss" | "push" | null;
  sessionWins: number;
  sessionLosses: number;

  tenValueProbabilityNow: number;
  dealerBustProbability: number | null;
  playerBustProbability: number | null;
}

export function getHiLoValue(card: Card): 1 | 0 | -1 {
  return (HI_LO_VALUES[card.rank] ?? 0) as 1 | 0 | -1;
}

export function updateRunningCount(currentCount: number, card: Card): number {
  return currentCount + getHiLoValue(card);
}

export function getCountDirection(runningCount: number): CountDirection {
  if (runningCount > 0) return "positive";
  if (runningCount < 0) return "negative";
  return "neutral";
}

export function getTenValueProbabilityNow(shoe: DeckState): number {
  const remaining = shoe.shoe;
  if (remaining.length === 0) return 0;
  const tenCount = remaining.filter((c) => c.blackjackValue === 10).length;
  return tenCount / remaining.length;
}

export function getPlayerBustProbabilityNow(hand: Card[], shoe: DeckState): number | null {
  if (hand.length === 0) return null;
  if (isSoft(hand)) return 0;
  const hardTotal = calculateHandValue(hand);
  if (hardTotal <= 11) return 0;
  if (hardTotal > 21) return null;
  const bustThreshold = 21 - hardTotal;
  const remaining = shoe.shoe;
  if (remaining.length === 0) return null;
  const bustingCards = remaining.filter((c) => c.blackjackValue > bustThreshold).length;
  return bustingCards / remaining.length;
}

export function getDealerBustProbability(upcard: Card | undefined): number | null {
  if (!upcard) return null;
  return DEALER_BUST_PROB[upcard.rank] ?? null;
}

export function getInitialLevel2State(): Level2State {
  return {
    stage: 1,
    phase: "tutor-intro",
    shoe: initShoe(6),
    playerHand: [],
    dealerHand: [],
    runningCount: 0,
    handStartCount: 0,
    handRunningCount: 0,
    cardCountValues: [],
    currentCardIndex: 0,
    playerDirectionInput: null,
    lastInputCorrect: null,
    correctInputs: 0,
    totalInputs: 0,
    consecutiveCorrect: 0,
    sessionComplete: false,
    stage2HandsPlayed: 0,
    stage3HandsCorrect: 0,
    stage4BlockHandsPlayed: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    lastDecisionCorrect: null,
    lastOutcome: null,
    sessionWins: 0,
    sessionLosses: 0,
    tenValueProbabilityNow: 16 / 52,
    dealerBustProbability: null,
    playerBustProbability: null,
  };
}

function dealCardAndTrack(
  shoe: DeckState,
  runningCount: number,
  cardCountValues: number[]
): { card: Card; shoe: DeckState; runningCount: number; cardCountValues: number[] } {
  const { card, newState } = dealCard(shoe);
  const hiLo = getHiLoValue(card);
  return {
    card,
    shoe: newState,
    runningCount: runningCount + hiLo,
    cardCountValues: [...cardCountValues, hiLo],
  };
}

export function startNewHand(state: Level2State): Level2State {
  let shoe = state.shoe;
  if (shoe.shoe.length < 15) shoe = initShoe(6);

  const startCount = state.runningCount;
  let runningCount = startCount;
  let cardCountValues: number[] = [];

  let p1: Card, p2: Card, d1: Card, d2: Card;
  ({ card: p1, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));
  ({ card: d1, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));
  ({ card: p2, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));
  ({ card: d2, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));

  const playerHand = [p1, p2];
  const tenProb = getTenValueProbabilityNow(shoe);

  if (calculateHandValue(playerHand) === 21) {
    return {
      ...state,
      shoe,
      playerHand,
      dealerHand: [d1, d2],
      phase: "round-over",
      runningCount,
      handStartCount: startCount,
      handRunningCount: runningCount,
      cardCountValues,
      currentCardIndex: 4,
      playerDirectionInput: null,
      lastInputCorrect: null,
      lastOutcome: "win",
      lastDecisionCorrect: null,
      tenValueProbabilityNow: tenProb,
      dealerBustProbability: getDealerBustProbability(d1),
      playerBustProbability: null,
      sessionWins: state.sessionWins + 1,
    };
  }
  return {
    ...state,
    shoe,
    playerHand,
    dealerHand: [d1, d2],
    phase: "player-turn",
    runningCount,
    handStartCount: startCount,
    handRunningCount: runningCount,
    cardCountValues,
    currentCardIndex: 4,
    playerDirectionInput: null,
    lastInputCorrect: null,
    lastOutcome: null,
    lastDecisionCorrect: null,
    tenValueProbabilityNow: tenProb,
    dealerBustProbability: getDealerBustProbability(d1),
    playerBustProbability: getPlayerBustProbabilityNow(playerHand, shoe),
  };
}

export function applyPlayerHit(state: Level2State): Level2State {
  let { shoe, runningCount, cardCountValues } = state;
  let card: Card;
  ({ card, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));

  const playerHand = [...state.playerHand, card];
  const busted = isBust(playerHand);
  const got21 = !busted && calculateHandValue(playerHand) === 21;
  const tenProb = getTenValueProbabilityNow(shoe);

  return {
    ...state,
    shoe,
    playerHand,
    runningCount,
    handRunningCount: runningCount,
    cardCountValues,
    currentCardIndex: state.currentCardIndex + 1,
    phase: busted || got21 ? "round-over" : "player-turn",
    tenValueProbabilityNow: tenProb,
    playerBustProbability: busted || got21 ? null : getPlayerBustProbabilityNow(playerHand, shoe),
    lastOutcome: busted ? "loss" : got21 ? "win" : state.lastOutcome,
    sessionLosses: busted ? state.sessionLosses + 1 : state.sessionLosses,
    sessionWins: got21 ? state.sessionWins + 1 : state.sessionWins,
  };
}

export function applyPlayerStand(state: Level2State): Level2State {
  return { ...state, phase: "dealer-turn" };
}

export function runDealerPlay(state: Level2State): Level2State {
  let { shoe, runningCount, cardCountValues } = state;
  let dealerHand = [...state.dealerHand];

  while (true) {
    const total = calculateHandValue(dealerHand);
    if (total > 17 || (total === 17 && !isSoft(dealerHand))) break;
    let card: Card;
    ({ card, shoe, runningCount, cardCountValues } = dealCardAndTrack(shoe, runningCount, cardCountValues));
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
    runningCount,
    handRunningCount: runningCount,
    cardCountValues,
    phase: "round-over",
    lastOutcome,
    tenValueProbabilityNow: getTenValueProbabilityNow(shoe),
    sessionWins: lastOutcome === "win" ? state.sessionWins + 1 : state.sessionWins,
    sessionLosses: lastOutcome === "loss" ? state.sessionLosses + 1 : state.sessionLosses,
  };
}

export function submitDirectionInput(
  state: Level2State,
  input: "positive" | "negative"
): Level2State {
  const trueDirection = getCountDirection(state.handRunningCount);
  const correct = trueDirection === "neutral" || trueDirection === input;

  const newCorrectInputs = state.correctInputs + (correct ? 1 : 0);
  const newTotalInputs = state.totalInputs + 1;
  const newConsecutive = correct ? state.consecutiveCorrect + 1 : 0;

  let nextStage3Correct = state.stage3HandsCorrect;
  if (state.stage === 3) {
    nextStage3Correct = correct ? state.stage3HandsCorrect + 1 : 0;
  }

  const sessionComplete =
    state.stage === 4 && newConsecutive >= STAGE4_STREAK_NEEDED;

  return {
    ...state,
    playerDirectionInput: input,
    lastInputCorrect: correct,
    correctInputs: newCorrectInputs,
    totalInputs: newTotalInputs,
    consecutiveCorrect: newConsecutive,
    stage3HandsCorrect: nextStage3Correct,
    sessionComplete,
    phase: "tutor-feedback",
  };
}

export function advanceAfterFeedback(state: Level2State): Level2State {
  if (state.sessionComplete) {
    return { ...state, phase: "session-over" };
  }

  if (state.stage === 2) {
    const handsAfter = state.stage2HandsPlayed + 1;
    if (handsAfter >= STAGE2_HAND_COUNT) {
      return { ...state, stage: 3, phase: "tutor-intro", stage2HandsPlayed: handsAfter };
    }
    return startNewHand({ ...state, stage2HandsPlayed: handsAfter });
  }

  if (state.stage === 3) {
    if (state.stage3HandsCorrect >= STAGE3_STREAK_NEEDED) {
      return { ...state, stage: 4, phase: "tutor-intro", consecutiveCorrect: 0 };
    }
    return startNewHand(state);
  }

  if (state.stage === 4) {
    const blockAfter = state.stage4BlockHandsPlayed + 1;
    if (blockAfter >= STAGE4_BLOCK_SIZE) {
      return startNewHand({ ...state, stage4BlockHandsPlayed: 0 });
    }
    return startNewHand({ ...state, stage4BlockHandsPlayed: blockAfter });
  }

  return state;
}

export function advanceAfterStage2Hand(state: Level2State): Level2State {
  const handsAfter = state.stage2HandsPlayed + 1;
  if (handsAfter >= STAGE2_HAND_COUNT) {
    return { ...state, stage: 3, phase: "tutor-intro", stage2HandsPlayed: handsAfter };
  }
  return startNewHand({ ...state, stage2HandsPlayed: handsAfter });
}

export function getLevel2GameContext(state: Level2State): string {
  const playerTotal = state.playerHand.length > 0 ? calculateHandValue(state.playerHand) : null;
  const soft = state.playerHand.length > 0 ? isSoft(state.playerHand) : false;
  const tenPct = `${Math.round(state.tenValueProbabilityNow * 100)}%`;
  const baseline = 0.31;
  const aboveBelow =
    state.tenValueProbabilityNow > baseline + 0.005
      ? "above baseline (shoe is ten-value rich)"
      : state.tenValueProbabilityNow < baseline - 0.005
      ? "below baseline (shoe is ten-value poor)"
      : "at baseline";
  const bustPct =
    state.playerBustProbability !== null
      ? `${Math.round(state.playerBustProbability * 100)}%`
      : soft
      ? "0% (soft hand)"
      : "0% (total too low)";
  const dealerBustPct =
    state.dealerBustProbability !== null
      ? `${Math.round(state.dealerBustProbability * 100)}%`
      : "unknown";

  const cardHiLoList = state.playerHand
    .map((c, i) => {
      const hiLo = getHiLoValue(c);
      const sign = hiLo > 0 ? `+${hiLo}` : `${hiLo}`;
      return `${c.rank} → ${sign}`;
    })
    .concat(
      state.dealerHand.slice(0, 1).map((c) => {
        const hiLo = getHiLoValue(c);
        const sign = hiLo > 0 ? `+${hiLo}` : `${hiLo}`;
        return `${c.rank} (dealer up) → ${sign}`;
      })
    )
    .join(", ");

  const direction = getCountDirection(state.handRunningCount);
  const inputStr =
    state.playerDirectionInput !== null
      ? `${state.playerDirectionInput} — ${state.lastInputCorrect ? "CORRECT" : "INCORRECT"}`
      : "not yet submitted";

  const streakTarget = state.stage === 3 ? STAGE3_STREAK_NEEDED : STAGE4_STREAK_NEEDED;
  const streakCurrent = state.stage === 3 ? state.stage3HandsCorrect : state.consecutiveCorrect;

  return [
    "Level 2 — Running Count Direction & Shoe Probability",
    "Level 1 baseline: 31% ten-value in a fresh deck",
    `P(Ten-Value Now): ${tenPct} — ${aboveBelow}`,
    `Player hand: ${state.playerHand.map((c) => c.rank).join(", ")}${playerTotal !== null ? ` (total: ${playerTotal}, ${soft ? "soft" : "hard"})` : ""}`,
    `Player bust probability if hitting: ${bustPct} (live shoe)`,
    `Dealer upcard: ${state.dealerHand[0]?.rank ?? "none"} (dealer bust probability: ${dealerBustPct})`,
    `Cards dealt this hand with Hi-Lo values: ${cardHiLoList || "none yet"}`,
    `Running count direction this hand: ${direction}`,
    `Player input: ${inputStr}`,
    `Stage: ${state.stage}, Phase: ${state.phase}`,
    `Streak: ${streakCurrent} consecutive correct (need ${streakTarget} to advance)`,
    `Session: ${state.correctInputs}/${state.totalInputs} correct direction inputs`,
  ].join("\n");
}

export function getStageIntroContext(stage: 1 | 2 | 3 | 4): string {
  if (stage === 1) {
    return [
      "Level 2 — Running Count Direction (Stage 1: Hi-Lo Introduction)",
      "Task: Welcome the player to Level 2. Explain the Hi-Lo counting system: cards 2–6 are each assigned +1 because their removal raises the remaining ten-value fraction above the 31% baseline from Level 1; cards 7–9 are 0 (neutral); cards 10, J, Q, K, and A are each assigned −1 because their removal lowers the ten-value fraction below 31%. Explain that a positive running count means more low cards have left the shoe — making the remaining deck richer in high cards — which raises bust probabilities compared to Level 1. Keep to 3–4 sentences. Do NOT mention true count, bet sizing, Double Down, or Split.",
    ].join("\n");
  }
  if (stage === 2) {
    return [
      "Level 2 — Running Count Direction (Stage 2: Observed Hands)",
      "Task: Remind the player that they will now play 3 hands. After each hand the tutor will reveal the running count direction and explain how it reflects the shoe's drift from the 31% Level 1 baseline. They do not need to input anything yet — just observe. Keep to 2 sentences.",
    ].join("\n");
  }
  if (stage === 3) {
    return [
      "Level 2 — Running Count Direction (Stage 3: Guided Count Input)",
      "Task: Tell the player that they will now practice identifying the count direction themselves. After each hand ends, they must press + or − to indicate whether the running count is positive or negative. They need 3 consecutive correct answers to advance. Keep to 2–3 sentences.",
    ].join("\n");
  }
  return [
    "Level 2 — Running Count Direction (Stage 4: Independent Practice)",
    "Task: Tell the player this is the final challenge. They must input the count direction (+ or −) after each complete hand — without per-card hints. They need 5 consecutive correct inputs to complete the level. Remind them the P(Ten-Value Now) HUD is always visible. Keep to 2–3 sentences.",
  ].join("\n");
}
