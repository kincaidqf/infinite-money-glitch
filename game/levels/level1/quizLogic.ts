export interface BustQuizData {
  playerAction: "hit" | "stand";
  handTotal: number;
  isSoftHand: boolean;
  dealerUpcardRank: string;
  dealerBustProbability: number;
  // Wrong hit: ranks/cards that would bust
  bustCardRanks: string[];
  bustCardCount: number;
  bustProbability: number;
  // All ranks that improve the hand (for both hit and stand cases)
  allImprovingRanks: string[];
  allImprovingCount: number;
  improveProbability: number;
  // Wrong stand: best single-card improvement (highest reachable total)
  bestImprovementCards: string[];
  bestImprovementTotal: number;
  bestImprovementCount: number;
  bestImprovementProbability: number;
}

// Quiz progresses: 1 = bust/stand question, 2 = improvement question, 3 = count question, 4 = complete
export type QuizStep = 1 | 2 | 3 | 4;

export interface SoftHandQuizData {
  handTotal: number;
  hardEquivalent: number;
  dealerUpcardRank: string;
  dealerBustProbability: number;
  ranksToReach21: string[];
  countToReach21: number;
  probToReach21: number;
  ranksToReach20: string[];
  countToReach20: number;
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

const DEALER_BUST_PROB: Record<string, number> = {
  "2": 0.353, "3": 0.376, "4": 0.403, "5": 0.429, "6": 0.423,
  "7": 0.262, "8": 0.244, "9": 0.230, "10": 0.214,
  "J": 0.214, "Q": 0.214, "K": 0.214, "A": 0.117,
};

export function computeBustQuizData(
  playerAction: "hit" | "stand",
  handTotal: number,
  isSoftHand: boolean,
  dealerUpcardRank: string
): BustQuizData {
  const dealerBustProbability = DEALER_BUST_PROB[dealerUpcardRank] ?? 0.214;

  // Compute all busting ranks
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

  // Compute all improving ranks (any card that improves total without busting)
  const allImprovingRanks: string[] = [];
  let allImprovingCount = 0;
  const seenImprovingValues = new Set<number>();
  for (const [rank, value, count] of RANK_IMPROVEMENT_CHECK) {
    let finalTotal = handTotal + value;
    if (rank === "A" && finalTotal > 21) finalTotal = handTotal + 1;
    if (finalTotal > 21) continue;
    if (finalTotal > handTotal) {
      // Group 10-value cards under one entry
      const key = Math.min(value, 10);
      if (!seenImprovingValues.has(key)) {
        seenImprovingValues.add(key);
        allImprovingRanks.push(rank === "A" ? "A" : value >= 10 ? "10/J/Q/K" : rank);
      }
      allImprovingCount += count;
    }
  }
  // Deduplicate 10-value count: 10/J/Q/K all counted separately, collapse to unique set
  allImprovingCount = 0;
  const countedTenValue = { done: false };
  for (const [rank, value, count] of RANK_IMPROVEMENT_CHECK) {
    let finalTotal = handTotal + value;
    if (rank === "A" && finalTotal > 21) finalTotal = handTotal + 1;
    if (finalTotal > 21) continue;
    if (finalTotal > handTotal) {
      if (value >= 10 && rank !== "A") {
        if (!countedTenValue.done) {
          allImprovingCount += 16;
          countedTenValue.done = true;
        }
      } else {
        allImprovingCount += count;
      }
    }
  }

  // Compute best single improvement (highest reachable total)
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
    playerAction, handTotal, isSoftHand, dealerUpcardRank, dealerBustProbability,
    bustCardRanks, bustCardCount, bustProbability: bustCardCount / 52,
    allImprovingRanks, allImprovingCount, improveProbability: allImprovingCount / 52,
    bestImprovementCards, bestImprovementTotal: bestFinalTotal,
    bestImprovementCount, bestImprovementProbability: bestImprovementCount / 52,
  };
}

export function computeSoftHandQuizData(
  handTotal: number,
  dealerUpcardRank: string
): SoftHandQuizData {
  const dealerBustProbability = DEALER_BUST_PROB[dealerUpcardRank] ?? 0.214;
  // Ace as 1 equivalent
  const hardEquivalent = handTotal - 10;

  const ranksToReach21: string[] = [];
  let countToReach21 = 0;
  const ranksToReach20: string[] = [];
  let countToReach20 = 0;

  for (const [rank, value, count] of RANK_IMPROVEMENT_CHECK) {
    // For soft hands, ace absorbs one card — hitting always produces a valid total
    let finalTotal = handTotal + value;
    if (finalTotal > 21) finalTotal = hardEquivalent + value;
    if (finalTotal > 21) continue;
    if (finalTotal === 21) { ranksToReach21.push(rank); countToReach21 += count; }
    if (finalTotal === 20) { ranksToReach20.push(rank); countToReach20 += count; }
  }

  return {
    handTotal, hardEquivalent, dealerUpcardRank, dealerBustProbability,
    ranksToReach21, countToReach21, probToReach21: countToReach21 / 52,
    ranksToReach20, countToReach20,
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

// Step 1 for wrong hit: how many BUST ranks?
// Step 1 for wrong stand: how many ranks IMPROVE your hand without busting?
export function evaluateStep1(quiz: BustQuizData, studentAnswer: string): { correct: boolean; hint: string } {
  if (quiz.playerAction === "hit") {
    const parsed = parseIntFromAnswer(studentAnswer);
    const expected = quiz.bustCardRanks.length;
    if (parsed === expected) return { correct: true, hint: "" };
    const hint = parsed === null
      ? `Give a number. Count how many distinct card ranks satisfy: ${quiz.handTotal} + rank value > 21.`
      : parsed < expected
      ? `Think higher. Some larger card values also push ${quiz.handTotal} over 21.`
      : `That is too many. Only count the ranks where ${quiz.handTotal} plus that card value strictly exceeds 21.`;
    return { correct: false, hint };
  }
  // Wrong stand: count improving ranks
  const parsed = parseIntFromAnswer(studentAnswer);
  const expected = quiz.allImprovingRanks.length;
  if (parsed === expected) return { correct: true, hint: "" };
  const hint = parsed === null
    ? `Give a number. Count distinct card ranks where ${quiz.handTotal} plus that value stays at or below 21 and gives a higher total.`
    : parsed < expected
    ? `Think higher. Even small cards like 2s and 3s improve a ${quiz.handTotal}.`
    : `Too many. Only count ranks where the new total exceeds ${quiz.handTotal} without going over 21.`;
  return { correct: false, hint };
}

// Step 2: how many total BUST cards (hit) or total IMPROVING cards (stand) out of 52?
export function evaluateStep2(quiz: BustQuizData, studentAnswer: string): { correct: boolean; hint: string } {
  const parsed = parseIntFromAnswer(studentAnswer);
  if (quiz.playerAction === "hit") {
    const expected = quiz.bustCardCount;
    if (parsed === expected) return { correct: true, hint: "" };
    const n = quiz.bustCardRanks.length;
    return { correct: false, hint: `There are 4 suits per rank. Try: ${n} ranks x 4.` };
  }
  // Wrong stand: count improving cards
  const expected = quiz.allImprovingCount;
  if (parsed === expected) return { correct: true, hint: "" };
  const n = quiz.allImprovingRanks.length;
  return { correct: false, hint: `Each rank has 4 cards (one per suit). Try: ${n} ranks x 4 cards each.` };
}

// Step 3 for soft hand wrong hit: how many cards reach 20 or 21?
export function evaluateSoftStep1(quiz: SoftHandQuizData, studentAnswer: string): { correct: boolean; hint: string } {
  const parsed = parseIntFromAnswer(studentAnswer);
  const expected = quiz.countToReach21;
  if (parsed === expected) return { correct: true, hint: "" };
  return {
    correct: false,
    hint: `Count how many cards added to soft ${quiz.handTotal} give exactly 21. Hint: ${quiz.ranksToReach21.join(", ")} each have 4 copies.`,
  };
}

// ─── LLM context builders — all numbers pre-computed, no LLM math ─────────────

export function getStage5QuizInitialContext(quiz: BustQuizData): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);

  if (quiz.playerAction === "hit") {
    const bustPct = Math.round(quiz.bustProbability * 100);
    return [
      `Stage 5 Probability Quiz — player hit hard ${quiz.handTotal}, should have stood. Dealer upcard: ${quiz.dealerUpcardRank} (dealer busts ${dealerPct}% of the time from this card).`,
      `This is a 3-part quiz. Start with part 1 only.`,
      `Part 1 task: Ask exactly this question: "With a hard ${quiz.handTotal}, how many different card ranks in a standard deck would cause you to bust if you drew one more card?"`,
      `Do not mention ${bustPct}%, do not give any numbers, hints, or examples. Ask in 1-2 sentences. Plain text only.`,
    ].join("\n");
  }

  return [
    `Stage 5 Probability Quiz — player stood on hard ${quiz.handTotal}, should have hit. Dealer upcard: ${quiz.dealerUpcardRank} (dealer busts only ${dealerPct}% of the time — the player needed to improve their hand).`,
    `This is a 3-part quiz. Start with part 1 only.`,
    `Part 1 task: Ask exactly this question: "With a hard ${quiz.handTotal}, how many different card ranks in a standard deck would improve your total without causing you to bust?"`,
    `Do not give any numbers, hints, or examples. Ask in 1-2 sentences. Plain text only.`,
  ].join("\n");
}

export function getStage5QuizStep1EvalContext(
  quiz: BustQuizData,
  studentAnswer: string,
  correct: boolean,
  hint: string
): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);

  if (quiz.playerAction === "hit") {
    const n = quiz.bustCardRanks.length;
    const ranks = quiz.bustCardRanks.join(", ");
    if (correct) {
      return [
        `Part 1 result: Student answered "${studentAnswer}" — CORRECT. The ${n} bust ranks are: ${ranks}.`,
        `Task: Confirm correct in 1 sentence. Then ask part 2: "Each rank has 4 cards in a standard deck — so how many total cards out of 52 would cause a bust?" Do not give the number. Plain text only.`,
      ].join("\n");
    }
    return [
      `Part 1 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${n} bust ranks.`,
      `Hint to deliver verbatim: "${hint}"`,
      `Task: Say that is not right (1 sentence). Deliver the hint exactly. Do NOT reveal the count or any rank names. Ask them to try again. Plain text only.`,
    ].join("\n");
  }

  const n = quiz.allImprovingRanks.length;
  const improvePct = Math.round(quiz.improveProbability * 100);
  if (correct) {
    return [
      `Part 1 result: Student answered "${studentAnswer}" — CORRECT. ${n} distinct rank groups improve a hard ${quiz.handTotal} without busting.`,
      `Task: Confirm correct in 1 sentence. Then ask part 2: "How many total cards out of 52 is that?" (count all suits: ${n} groups x 4 cards each, but note 10/J/Q/K together = 16). Do not give ${improvePct}% yet. Plain text only.`,
    ].join("\n");
  }
  return [
    `Part 1 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${n} rank groups improve hard ${quiz.handTotal}.`,
    `Hint to deliver verbatim: "${hint}"`,
    `Task: Say that is not right (1 sentence). Deliver the hint exactly. Do NOT reveal the count. Ask them to try again. Plain text only.`,
  ].join("\n");
}

export function getStage5QuizStep2EvalContext(
  quiz: BustQuizData,
  studentAnswer: string,
  correct: boolean,
  hint: string
): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);

  if (quiz.playerAction === "hit") {
    const bustTotal = quiz.bustCardCount;
    const bustPct = Math.round(quiz.bustProbability * 100);
    const improveTotal = quiz.allImprovingCount;
    const improvePct = Math.round(quiz.improveProbability * 100);
    if (correct) {
      return [
        `Part 2 result: Student answered "${studentAnswer}" — CORRECT. ${bustTotal} bust cards out of 52 = ${bustPct}% chance of busting.`,
        `Task: Confirm correct (1 sentence). Then ask part 3: "How many of the remaining ${52 - bustTotal} non-bust cards would actually improve your total?" (answer: ${improveTotal} cards = ${improvePct}%). Do not give these numbers yet. Plain text only.`,
      ].join("\n");
    }
    return [
      `Part 2 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${bustTotal} cards.`,
      `Hint to deliver verbatim: "${hint}"`,
      `Task: Say that is not right (1 sentence). Deliver the hint exactly. Do NOT reveal the count. Ask them to try again. Plain text only.`,
    ].join("\n");
  }

  // Wrong stand
  const improveTotal = quiz.allImprovingCount;
  const improvePct = Math.round(quiz.improveProbability * 100);
  const bustTotal = quiz.bustCardCount;
  const bustPct = Math.round(quiz.bustProbability * 100);
  if (correct) {
    return [
      `Part 2 result: Student answered "${studentAnswer}" — CORRECT. ${improveTotal} improving cards out of 52 = ${improvePct}% chance of improving.`,
      `Task: Confirm correct (1 sentence). Then ask part 3: "Now think about the dealer — they bust only ${dealerPct}% of the time from a ${quiz.dealerUpcardRank}. Given your ${improvePct}% chance of improving vs. the dealer's ${dealerPct}% bust rate, what does the math say you should do?" Plain text only.`,
    ].join("\n");
  }
  return [
    `Part 2 result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${improveTotal} improving cards.`,
    `Hint to deliver verbatim: "${hint}"`,
    `Task: Say that is not right (1 sentence). Deliver the hint exactly. Do NOT reveal the count. Ask them to try again. Plain text only.`,
  ].join("\n");
}

export function getStage5QuizStep3EvalContext(
  quiz: BustQuizData,
  studentAnswer: string
): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);

  if (quiz.playerAction === "hit") {
    const bustPct = Math.round(quiz.bustProbability * 100);
    const improvePct = Math.round(quiz.improveProbability * 100);
    const remaining = 52 - quiz.bustCardCount;
    return [
      `Part 3: Student answered "${studentAnswer}" about the ${remaining} non-bust cards improving hard ${quiz.handTotal}.`,
      `Correct answer: ${quiz.allImprovingCount} cards (${improvePct}%) would improve the ${quiz.handTotal}. The other ${remaining - quiz.allImprovingCount} leave it unchanged or produce a lower-value total.`,
      `Task: Confirm or gently correct their answer. Then give the final synthesis in 2 sentences: "${bustPct}% of cards bust you — that is more than half the deck. Meanwhile the dealer busts only ${dealerPct}% from a ${quiz.dealerUpcardRank}, so the math says stand: your bust risk outweighs the dealer's bust chance." Plain text only.`,
    ].join("\n");
  }

  // Wrong stand: final synthesis — student was asked to reason about hit vs. stand given both probabilities
  const improvePct = Math.round(quiz.improveProbability * 100);
  const bustPct = Math.round(quiz.bustProbability * 100);
  return [
    `Part 3: Student reasoned about hitting hard ${quiz.handTotal} vs. dealer ${quiz.dealerUpcardRank}.`,
    `Key numbers: ${improvePct}% chance of improving, ${bustPct}% chance of busting, dealer busts only ${dealerPct}% from a ${quiz.dealerUpcardRank}.`,
    `Task: Evaluate their reasoning briefly (1 sentence). Then give the final synthesis: "With ${improvePct}% of cards improving your ${quiz.handTotal} and the dealer unlikely to bust at ${dealerPct}%, hitting was correct — the math favors drawing. One sentence on why the denominator shrinks as cards leave the deck but this principle holds." 3 sentences total. Plain text only.`,
  ].join("\n");
}

export function getSoftHandQuizInitialContext(quiz: SoftHandQuizData): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);
  return [
    `Stage 5 Probability Quiz — player incorrectly hit soft ${quiz.handTotal} (Ace + ${quiz.handTotal - 11}), should have stood. Dealer upcard: ${quiz.dealerUpcardRank} (dealer busts ${dealerPct}% of the time).`,
    `Note: a soft hand cannot bust on a single card — the Ace absorbs the hit by counting as 1.`,
    `Task: Ask exactly this question: "You have a soft ${quiz.handTotal}. On a soft hand the Ace can count as 1 if needed — so you cannot bust on one card. How many cards out of 52 would actually improve you to a total of 21?"`,
    `Do not give the answer or any numbers. Ask in 1-2 sentences. Plain text only.`,
  ].join("\n");
}

export function getSoftHandQuizStep1EvalContext(
  quiz: SoftHandQuizData,
  studentAnswer: string,
  correct: boolean
): string {
  const dealerPct = Math.round(quiz.dealerBustProbability * 100);
  const reachPct = Math.round(quiz.probToReach21 * 100);
  if (correct) {
    return [
      `Soft quiz result: Student answered "${studentAnswer}" — CORRECT. ${quiz.countToReach21} cards reach 21 from soft ${quiz.handTotal} (${quiz.ranksToReach21.join(", ")}, 4 each).`,
      `Task: Confirm correct (1 sentence). Then give the synthesis: "So only ${reachPct}% of the deck improves soft ${quiz.handTotal} to 21. You were already at ${quiz.handTotal} — a very strong total. The dealer busts just ${dealerPct}% from a ${quiz.dealerUpcardRank}, so standing is correct: you have little to gain and a strong hand to protect." 2-3 sentences. Plain text only.`,
    ].join("\n");
  }
  return [
    `Soft quiz result: Student answered "${studentAnswer}" — INCORRECT. Correct answer: ${quiz.countToReach21} cards (${quiz.ranksToReach21.join(", ")}, 4 suits each).`,
    `Task: Tell them that is not right (1 sentence). Hint: "Count how many copies of ${quiz.ranksToReach21.join(" and ")} exist in a 52-card deck." Ask them to try again. Plain text only.`,
  ].join("\n");
}
