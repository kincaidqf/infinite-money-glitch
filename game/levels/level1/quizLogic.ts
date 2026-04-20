export interface BustQuizData {
  playerAction: "hit" | "stand";
  handTotal: number;
  isSoftHand: boolean;
  dealerUpcardRank: string;
  // For wrong hit (should have stood): ranks that would cause a bust
  bustCardRanks: string[];
  bustCardCount: number;
  bustProbability: number;
  // For wrong stand (should have hit): best single-card improvement
  bestImprovementCards: string[];
  bestImprovementTotal: number;
  bestImprovementCount: number;
  bestImprovementProbability: number;
}

// Ace = 1 when hitting a hard hand (ace as 11 would bust any total >= 11)
const RANK_BUST_CHECK: Array<[string, number, number]> = [
  ["A", 1, 4],
  ["2", 2, 4], ["3", 3, 4], ["4", 4, 4], ["5", 5, 4],
  ["6", 6, 4], ["7", 7, 4], ["8", 8, 4], ["9", 9, 4],
  ["10", 10, 4], ["J", 10, 4], ["Q", 10, 4], ["K", 10, 4],
];

// Ordered from best improvement to worst (Ace as 11 first)
const RANK_IMPROVEMENT_CHECK: Array<[string, number, number]> = [
  ["A", 11, 4],
  ["K", 10, 4], ["Q", 10, 4], ["J", 10, 4], ["10", 10, 4],
  ["9", 9, 4], ["8", 8, 4], ["7", 7, 4], ["6", 6, 4],
  ["5", 5, 4], ["4", 4, 4], ["3", 3, 4], ["2", 2, 4],
];

export function computeBustQuizData(
  playerAction: "hit" | "stand",
  handTotal: number,
  isSoftHand: boolean,
  dealerUpcardRank: string
): BustQuizData {
  if (playerAction === "hit") {
    const bustCardRanks: string[] = [];
    let bustCardCount = 0;
    if (!isSoftHand) {
      for (const [rank, value, count] of RANK_BUST_CHECK) {
        if (handTotal + value > 21) {
          bustCardRanks.push(rank);
          bustCardCount += count;
        }
      }
    }
    return {
      playerAction, handTotal, isSoftHand, dealerUpcardRank,
      bustCardRanks, bustCardCount, bustProbability: bustCardCount / 52,
      bestImprovementCards: [], bestImprovementTotal: 0,
      bestImprovementCount: 0, bestImprovementProbability: 0,
    };
  }

  let bestFinalTotal = 0;
  const bestImprovementCards: string[] = [];
  let bestImprovementCount = 0;

  for (const [rank, value, count] of RANK_IMPROVEMENT_CHECK) {
    let finalTotal = handTotal + value;
    if (rank === "A" && finalTotal > 21) finalTotal = handTotal + 1;
    if (finalTotal > 21) continue;
    if (finalTotal > bestFinalTotal) {
      bestFinalTotal = finalTotal;
      bestImprovementCards.length = 0;
      bestImprovementCards.push(rank);
      bestImprovementCount = count;
    } else if (finalTotal === bestFinalTotal) {
      bestImprovementCards.push(rank);
      bestImprovementCount += count;
    }
  }

  return {
    playerAction, handTotal, isSoftHand, dealerUpcardRank,
    bustCardRanks: [], bustCardCount: 0, bustProbability: 0,
    bestImprovementCards, bestImprovementTotal: bestFinalTotal,
    bestImprovementCount, bestImprovementProbability: bestImprovementCount / 52,
  };
}

export function getStage5QuizContext(quiz: BustQuizData): string {
  if (quiz.playerAction === "hit") {
    const pct = Math.round(quiz.bustProbability * 100);
    return [
      "Stage 5 Probability Quiz — Player hit when they should have stood.",
      `Player hand before that hit: Hard ${quiz.handTotal}. Dealer upcard: ${quiz.dealerUpcardRank}.`,
      `Correct action was: Stand.`,
      "",
      `Quiz task: Ask the student how many different CARD RANKS in a standard 52-card deck would cause a bust if dealt to a hard ${quiz.handTotal}.`,
      `Do NOT reveal the answer yet. Ask the question and wait for the student to respond.`,
      `Correct answer: ${quiz.bustCardRanks.length} bust ranks (${quiz.bustCardRanks.join(", ")}) x 4 cards each = ${quiz.bustCardCount} out of 52 = ${pct}% bust chance.`,
      `After they answer: confirm or correct, then explain the full calculation. Note we use 52 as the denominator for simplicity — in practice it shrinks as cards leave the deck.`,
      `Ask the question in 1-2 plain sentences. No special characters.`,
    ].join("\n");
  }

  const cardLabel = quiz.bestImprovementCards.length === 1
    ? quiz.bestImprovementCards[0]
    : quiz.bestImprovementCards.join(" or ");
  const pct = Math.round(quiz.bestImprovementProbability * 100);

  return [
    "Stage 5 Probability Quiz — Player stood when they should have hit.",
    `Player hand: Hard ${quiz.handTotal}. Dealer upcard: ${quiz.dealerUpcardRank}.`,
    `Correct action was: Hit.`,
    "",
    `Quiz task: Ask the student what single card (or group of same-value cards) would give the HIGHEST possible hand total without busting from a hard ${quiz.handTotal}.`,
    `Do NOT reveal the answer yet. Ask the question and wait for the student to respond.`,
    `Correct answer: ${cardLabel} gives a total of ${quiz.bestImprovementTotal}. That is ${quiz.bestImprovementCount} cards out of 52 = ${pct}%.`,
    `After they answer: confirm or correct, then explain why this is the best single draw. Note we use 52 as the denominator for simplicity.`,
    `Ask the question in 1-2 plain sentences. No special characters.`,
  ].join("\n");
}

export function getStage5QuizAnswerContext(quiz: BustQuizData, studentAnswer: string): string {
  if (quiz.playerAction === "hit") {
    const pct = Math.round(quiz.bustProbability * 100);
    return [
      "Stage 5 Probability Quiz — Student is answering the bust-card question.",
      `Player hand before hit: Hard ${quiz.handTotal}. Dealer upcard: ${quiz.dealerUpcardRank}.`,
      `Student answered: "${studentAnswer}"`,
      `Correct answer: ${quiz.bustCardRanks.length} bust ranks (${quiz.bustCardRanks.join(", ")}) x 4 cards each = ${quiz.bustCardCount} out of 52 = ${pct}% bust chance.`,
      `Task: Confirm or correct the student's answer. Walk through: each rank has 4 cards, so ${quiz.bustCardRanks.length} ranks x 4 = ${quiz.bustCardCount}. ${quiz.bustCardCount}/52 = ${pct}%.`,
      `Remind them: we use 52 for simplicity; in practice the denominator changes as cards are dealt.`,
      `Keep to 3-4 sentences. Plain text only. No special characters.`,
    ].join("\n");
  }

  const cardLabel = quiz.bestImprovementCards.length === 1
    ? quiz.bestImprovementCards[0]
    : quiz.bestImprovementCards.join(" or ");
  const pct = Math.round(quiz.bestImprovementProbability * 100);

  return [
    "Stage 5 Probability Quiz — Student is answering the best-improvement-card question.",
    `Player hand: Hard ${quiz.handTotal}. Dealer upcard: ${quiz.dealerUpcardRank}.`,
    `Student answered: "${studentAnswer}"`,
    `Correct answer: ${cardLabel} gives a total of ${quiz.bestImprovementTotal}. That is ${quiz.bestImprovementCount} cards out of 52 = ${pct}%.`,
    `Task: Confirm or correct the student's answer. Explain why ${cardLabel} is the best single draw from a hard ${quiz.handTotal}.`,
    `Remind them: we use 52 for simplicity; in practice the denominator changes as cards are dealt.`,
    `Keep to 3-4 sentences. Plain text only. No special characters.`,
  ].join("\n");
}
