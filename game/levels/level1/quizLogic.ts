export interface BustQuizData {
  playerAction: "hit" | "stand";
  handTotal: number;
  isSoftHand: boolean;
  dealerUpcardRank: string;
  // Wrong hit: ranks/cards that would bust
  bustCardRanks: string[];
  bustCardCount: number;
  bustProbability: number;
  // Wrong stand: best single-card improvement
  bestImprovementCards: string[];
  bestImprovementTotal: number;
  bestImprovementCount: number;
  bestImprovementProbability: number;
}

// Quiz progresses: 1 = asking ranks/best-card, 2 = asking total cards, 3 = complete
export type QuizStep = 1 | 2 | 3;

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

// ─── Answer evaluation (all math done here, never by the LLM) ────────────────

function parseIntFromAnswer(answer: string): number | null {
  const match = answer.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

const TEN_VALUE_SET = new Set(["10", "king", "queen", "jack"]);

function normalizeCardName(card: string): string {
  const s = card.toLowerCase().trim();
  if (s === "a" || s.includes("ace")) return "ace";
  if (s === "k" || s.includes("king")) return "king";
  if (s === "q" || s.includes("queen")) return "queen";
  if (s === "j" || s.includes("jack")) return "jack";
  if (s === "10" || s.includes("ten") || s.includes("face") || s.includes("10-value")) return "10";
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

function formatBestCards(cards: string[]): string {
  const tenValues = new Set(["K", "Q", "J", "10"]);
  if (cards.length > 1 && cards.every(c => tenValues.has(c))) return "10-value cards (10, J, Q, K)";
  return cards.length === 1 ? cards[0] : cards.join(", ");
}

export function evaluateStep1(quiz: BustQuizData, studentAnswer: string): { correct: boolean; hint: string } {
  if (quiz.playerAction === "hit") {
    const parsed = parseIntFromAnswer(studentAnswer);
    const expected = quiz.bustCardRanks.length;
    if (parsed === expected) return { correct: true, hint: "" };
    const hint = parsed === null
      ? `Give a number. Count how many distinct card ranks satisfy: ${quiz.handTotal} + rank value > 21.`
      : parsed < expected
      ? `Think higher. Some larger card values also push ${quiz.handTotal} over 21.`
      : `That is too many. Only count the ranks where ${quiz.handTotal} plus that card value exceeds 21.`;
    return { correct: false, hint };
  }

  // Wrong stand: check card name match
  const normalized = normalizeCardName(studentAnswer);
  const bestNormalized = quiz.bestImprovementCards.map(c => normalizeCardName(c));
  const allBestAreTen = bestNormalized.every(c => TEN_VALUE_SET.has(c));
  const studentIsTen = TEN_VALUE_SET.has(normalized);
  const correct = bestNormalized.includes(normalized) || (allBestAreTen && studentIsTen);
  if (correct) return { correct: true, hint: "" };
  return {
    correct: false,
    hint: `Think about which single card added to ${quiz.handTotal} brings you closest to 21 without going over.`,
  };
}

export function evaluateStep2(quiz: BustQuizData, studentAnswer: string): { correct: boolean; hint: string } {
  const parsed = parseIntFromAnswer(studentAnswer);
  const expected = quiz.playerAction === "hit" ? quiz.bustCardCount : quiz.bestImprovementCount;
  if (parsed === expected) return { correct: true, hint: "" };
  if (quiz.playerAction === "hit") {
    const n = quiz.bustCardRanks.length;
    return { correct: false, hint: `There are 4 suits per rank. Try: ${n} ranks x 4.` };
  }
  const cardLabel = formatBestCards(quiz.bestImprovementCards);
  return { correct: false, hint: `Count how many ${cardLabel} exist in a standard 52-card deck.` };
}

// ─── LLM context builders — all numbers pre-computed, no LLM math ─────────────

export function getStage5QuizInitialContext(quiz: BustQuizData): string {
  if (quiz.playerAction === "hit") {
    return [
      `Stage 5 Probability Quiz (step 1 of 2) — player hit hard ${quiz.handTotal}, should have stood. Dealer upcard: ${quiz.dealerUpcardRank}.`,
      `Task: Ask exactly this question: "With a hard ${quiz.handTotal}, how many different card ranks in a standard deck would cause you to bust if you drew one more card?"`,
      `Do not give any numbers, hints, or examples. Ask the question in 1-2 sentences only. Plain text.`,
    ].join("\n");
  }
  return [
    `Stage 5 Probability Quiz (step 1 of 2) — player stood on hard ${quiz.handTotal}, should have hit. Dealer upcard: ${quiz.dealerUpcardRank}.`,
    `Task: Ask exactly this question: "With a hard ${quiz.handTotal}, what single card value would give you the highest possible total without busting?"`,
    `Do not reveal the answer or give hints. Ask the question in 1-2 sentences only. Plain text.`,
  ].join("\n");
}

export function getStage5QuizStep1EvalContext(
  quiz: BustQuizData,
  studentAnswer: string,
  correct: boolean,
  hint: string
): string {
  if (quiz.playerAction === "hit") {
    const n = quiz.bustCardRanks.length;
    const ranks = quiz.bustCardRanks.join(", ");
    if (correct) {
      return [
        `Step 1 result: Student answered "${studentAnswer}" — CORRECT. The ${n} bust ranks are: ${ranks}.`,
        `Task: Briefly confirm they are correct (1 sentence). Then ask: "Each rank has 4 cards in a standard deck, one per suit — so how many total cards out of 52 would cause a bust?" Do not give the number. Plain text only.`,
      ].join("\n");
    }
    return [
      `Step 1 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${n} ranks.`,
      `Hint to deliver verbatim: "${hint}"`,
      `Task: Tell them that is not right (1 sentence). Deliver the hint exactly as written. Do NOT reveal the correct count or any rank names. Ask them to try again. Plain text only.`,
    ].join("\n");
  }

  const cardLabel = formatBestCards(quiz.bestImprovementCards);
  const total = quiz.bestImprovementTotal;
  if (correct) {
    return [
      `Step 1 result: Student answered "${studentAnswer}" — CORRECT. ${cardLabel} gives a total of ${total}.`,
      `Task: Briefly confirm they are correct (1 sentence). Then ask: "How many ${cardLabel} cards are there in a standard 52-card deck?" Do not give the number. Plain text only.`,
    ].join("\n");
  }
  return [
    `Step 1 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${cardLabel} (gives total of ${total}).`,
    `Hint to deliver verbatim: "${hint}"`,
    `Task: Tell them that is not right (1 sentence). Deliver the hint exactly as written. Do NOT reveal the correct card. Ask them to try again. Plain text only.`,
  ].join("\n");
}

export function getStage5QuizStep2EvalContext(
  quiz: BustQuizData,
  studentAnswer: string,
  correct: boolean,
  hint: string
): string {
  if (quiz.playerAction === "hit") {
    const n = quiz.bustCardRanks.length;
    const total = quiz.bustCardCount;
    const pct = Math.round(quiz.bustProbability * 100);
    if (correct) {
      return [
        `Step 2 result: Student answered "${studentAnswer}" — CORRECT. ${n} ranks x 4 = ${total} out of 52.`,
        `Task: Confirm they are correct (1 sentence). Then give the final explanation using only these numbers: ${total} bust cards out of 52 equals ${pct}% chance of busting on that hit. Close by stating that this is why hard ${quiz.handTotal} is always a stand. Add one sentence noting the denominator shrinks in practice as cards are dealt but the principle holds.`,
        `3 sentences total. Plain text only.`,
      ].join("\n");
    }
    return [
      `Step 2 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${total}.`,
      `Hint to deliver verbatim: "${hint}"`,
      `Task: Tell them that is not right (1 sentence). Deliver the hint exactly as written. Do NOT reveal the correct total. Ask them to try again. Plain text only.`,
    ].join("\n");
  }

  const count = quiz.bestImprovementCount;
  const pct = Math.round(quiz.bestImprovementProbability * 100);
  const cardLabel = formatBestCards(quiz.bestImprovementCards);
  const bestTotal = quiz.bestImprovementTotal;
  if (correct) {
    return [
      `Step 2 result: Student answered "${studentAnswer}" — CORRECT. There are ${count} ${cardLabel} cards.`,
      `Task: Confirm they are correct (1 sentence). Then give the final explanation using only these numbers: ${count} out of 52 equals ${pct}% chance of drawing ${cardLabel} for a total of ${bestTotal}. Hitting was correct because you cannot bust on hard ${quiz.handTotal} in one draw. Add one sentence noting the denominator shrinks in practice as cards are dealt but the principle holds.`,
      `3 sentences total. Plain text only.`,
    ].join("\n");
  }
  return [
    `Step 2 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${count}.`,
    `Hint to deliver verbatim: "${hint}"`,
    `Task: Tell them that is not right (1 sentence). Deliver the hint exactly as written. Do NOT reveal the correct count. Ask them to try again. Plain text only.`,
  ].join("\n");
}
