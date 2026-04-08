import { type Card, buildDeck } from "@/lib/cards";
import { calculateHandValue } from "@/game/cardUtils";

export interface DeckState {
  shoe: Card[];
  dealt: Card[];
  runningCount: number;
  numDecks: number;
}

function shuffleCards(cards: Card[]): Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initShoe(numDecks: number = 1): DeckState {
  const cards: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    cards.push(...buildDeck());
  }
  return {
    shoe: shuffleCards(cards),
    dealt: [],
    runningCount: 0,
    numDecks,
  };
}

export function dealCard(state: DeckState): { card: Card; newState: DeckState } {
  if (state.shoe.length === 0) throw new Error("Shoe is empty");
  const [card, ...remaining] = state.shoe;
  return {
    card,
    newState: {
      ...state,
      shoe: remaining,
      dealt: [...state.dealt, card],
      runningCount: state.runningCount + card.hiLoValue,
    },
  };
}

export function getTrueCount(state: DeckState): number {
  const decksRemaining = state.shoe.length / 52;
  if (decksRemaining < 0.5) return state.runningCount;
  return Math.round(state.runningCount / decksRemaining);
}

export interface Probabilities {
  tenValueProb: number;
  aceProb: number;
  bustProb: number | null; // bust-if-hit for a given hand total; null if not applicable
}

export function getProbabilities(state: DeckState, handTotal: number | null = null): Probabilities {
  const remaining = state.shoe.length;
  if (remaining === 0) return { tenValueProb: 0, aceProb: 0, bustProb: null };

  const tenCount = state.shoe.filter((c) => c.blackjackValue === 10).length;
  const aceCount = state.shoe.filter((c) => c.rank === "A").length;

  let bustProb: number | null = null;
  if (handTotal !== null && handTotal >= 12 && handTotal <= 20) {
    const bustCount = state.shoe.filter((c) => c.blackjackValue > 21 - handTotal).length;
    bustProb = bustCount / remaining;
  }

  return {
    tenValueProb: tenCount / remaining,
    aceProb: aceCount / remaining,
    bustProb,
  };
}

export function getGameContext(
  state: DeckState,
  playerHand: Card[],
  dealerUpcard: Card | null
): string {
  const remaining = state.shoe.length;
  const total = state.numDecks * 52;
  const playerTotal = calculateHandValue(playerHand);
  const probs = getProbabilities(state, playerTotal);
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const lines = [
    `Shoe: ${remaining}/${total} cards remaining`,
    `Running count: ${sign(state.runningCount)}`,
    `True count: ${sign(getTrueCount(state))}`,
    `Player hand: ${playerHand.map((c) => c.rank).join(", ")} (total: ${playerTotal})`,
    dealerUpcard ? `Dealer upcard: ${dealerUpcard.rank}` : "Dealer upcard: hidden",
    `P(next card is 10-value): ${(probs.tenValueProb * 100).toFixed(1)}%`,
  ];

  if (probs.bustProb !== null) {
    lines.push(`P(bust if hit): ${(probs.bustProb * 100).toFixed(1)}%`);
  }

  return lines.join("\n");
}
