import type { Card, Rank } from "@/lib/cards";

function rankToFilename(rank: Rank): string {
  if (rank === "A" || rank === "J" || rank === "Q" || rank === "K") return rank;
  return rank.padStart(2, "0");
}

export function getCardImagePath(card: Card): string {
  return `/cards/card_${card.suit}_${rankToFilename(card.rank)}.png`;
}

export function getBackImagePath(): string {
  return "/cards/card_back.png";
}

export function calculateHandValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card.blackjackValue;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBust(cards: Card[]): boolean {
  return calculateHandValue(cards) > 21;
}

export function isSoft(cards: Card[]): boolean {
  const hasAce = cards.some((c) => c.rank === "A");
  if (!hasAce) return false;
  const hardTotal = cards.reduce((sum, c) => sum + (c.rank === "A" ? 1 : c.blackjackValue), 0);
  return hardTotal + 10 <= 21;
}
