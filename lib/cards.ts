export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  blackjackValue: number; // A=11 (soft), J/Q/K=10, number=face value
  hiLoValue: -1 | 0 | 1; // 2-6=+1, 7-9=0, 10/J/Q/K/A=-1
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function toBlackjackValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return parseInt(rank, 10);
}

function toHiLoValue(rank: Rank): -1 | 0 | 1 {
  const bv = toBlackjackValue(rank);
  if (bv >= 2 && bv <= 6) return 1;
  if (bv >= 7 && bv <= 9) return 0;
  return -1;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        blackjackValue: toBlackjackValue(rank),
        hiLoValue: toHiLoValue(rank),
      });
    }
  }
  return shuffle(cards);
}
