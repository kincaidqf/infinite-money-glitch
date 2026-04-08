import type { Card } from "@/lib/cards";
import { calculateHandValue, isSoft } from "@/game/cardUtils";

export type StrategyCode = "H" | "S" | "D" | "Ds" | "Y" | "N" | "Y/N";
export type UserAction = "hit" | "stand" | "double";

const STRATEGY = {
  pair_splitting: {
    "A,A": { "2":"Y","3":"Y","4":"Y","5":"Y","6":"Y","7":"Y","8":"Y","9":"Y","10":"Y","A":"Y" },
    "T,T": { "2":"N","3":"N","4":"N","5":"N","6":"N","7":"N","8":"N","9":"N","10":"N","A":"N" },
    "9,9": { "2":"Y","3":"Y","4":"Y","5":"Y","6":"Y","7":"N","8":"Y","9":"Y","10":"N","A":"N" },
    "8,8": { "2":"Y","3":"Y","4":"Y","5":"Y","6":"Y","7":"Y","8":"Y","9":"Y","10":"Y","A":"Y" },
    "7,7": { "2":"Y","3":"Y","4":"Y","5":"Y","6":"Y","7":"Y","8":"N","9":"N","10":"N","A":"N" },
    "6,6": { "2":"Y/N","3":"Y","4":"Y","5":"Y","6":"Y","7":"N","8":"N","9":"N","10":"N","A":"N" },
    "5,5": { "2":"N","3":"N","4":"N","5":"N","6":"N","7":"N","8":"N","9":"N","10":"N","A":"N" },
    "4,4": { "2":"N","3":"N","4":"N","5":"Y/N","6":"Y/N","7":"N","8":"N","9":"N","10":"N","A":"N" },
    "3,3": { "2":"Y/N","3":"Y/N","4":"Y","5":"Y","6":"Y","7":"Y","8":"N","9":"N","10":"N","A":"N" },
    "2,2": { "2":"Y/N","3":"Y/N","4":"Y","5":"Y","6":"Y","7":"Y","8":"N","9":"N","10":"N","A":"N" },
  },
  soft_totals: {
    "A,9": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"S","8":"S","9":"S","10":"S","A":"S" },
    "A,8": { "2":"S","3":"S","4":"S","5":"S","6":"Ds","7":"S","8":"S","9":"S","10":"S","A":"S" },
    "A,7": { "2":"Ds","3":"Ds","4":"Ds","5":"Ds","6":"Ds","7":"S","8":"S","9":"H","10":"H","A":"H" },
    "A,6": { "2":"H","3":"D","4":"D","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "A,5": { "2":"H","3":"H","4":"D","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "A,4": { "2":"H","3":"H","4":"D","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "A,3": { "2":"H","3":"H","4":"H","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "A,2": { "2":"H","3":"H","4":"H","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
  },
  hard_totals: {
    "17": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"S","8":"S","9":"S","10":"S","A":"S" },
    "16": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "15": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "14": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "13": { "2":"S","3":"S","4":"S","5":"S","6":"S","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "12": { "2":"H","3":"H","4":"S","5":"S","6":"S","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "11": { "2":"D","3":"D","4":"D","5":"D","6":"D","7":"D","8":"D","9":"D","10":"D","A":"D" },
    "10": { "2":"D","3":"D","4":"D","5":"D","6":"D","7":"D","8":"D","9":"D","10":"H","A":"H" },
    "9":  { "2":"H","3":"D","4":"D","5":"D","6":"D","7":"H","8":"H","9":"H","10":"H","A":"H" },
    "8":  { "2":"H","3":"H","4":"H","5":"H","6":"H","7":"H","8":"H","9":"H","10":"H","A":"H" },
  },
} as const;

type DealerKey = "2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"A";

function getDealerKey(upcard: Card): DealerKey {
  if (upcard.rank === "A") return "A";
  if (upcard.blackjackValue === 10) return "10";
  return upcard.rank as DealerKey;
}

function getPairKey(hand: Card[]): string | null {
  if (hand.length !== 2) return null;
  const [a, b] = hand;
  if (a.rank === "A" && b.rank === "A") return "A,A";
  if (a.blackjackValue === 10 && b.blackjackValue === 10) return "T,T";
  if (a.rank === b.rank) return `${a.rank},${a.rank}`;
  return null;
}

function getSoftKey(hand: Card[]): string | null {
  if (!isSoft(hand)) return null;
  const total = calculateHandValue(hand);
  const nonAceValue = total - 11;
  if (nonAceValue >= 2 && nonAceValue <= 9) return `A,${nonAceValue}`;
  return null;
}

// Resolves H/S/D/Ds only — skips pair splitting logic.
function getHardSoftAction(playerHand: Card[], dealerUpcard: Card): StrategyCode {
  const dk = getDealerKey(dealerUpcard);

  const softKey = getSoftKey(playerHand);
  if (softKey && softKey in STRATEGY.soft_totals) {
    const row = STRATEGY.soft_totals[softKey as keyof typeof STRATEGY.soft_totals];
    return row[dk] as StrategyCode;
  }

  const total = calculateHandValue(playerHand);
  if (total >= 17) return "S";
  if (total <= 7) return "H";

  const hardKey = String(total) as keyof typeof STRATEGY.hard_totals;
  if (hardKey in STRATEGY.hard_totals) {
    const row = STRATEGY.hard_totals[hardKey];
    return row[dk] as StrategyCode;
  }
  return "H";
}

export function getBasicStrategyAction(playerHand: Card[], dealerUpcard: Card): StrategyCode {
  const dk = getDealerKey(dealerUpcard);

  if (playerHand.length === 2) {
    const pairKey = getPairKey(playerHand);
    if (pairKey && pairKey in STRATEGY.pair_splitting) {
      const row = STRATEGY.pair_splitting[pairKey as keyof typeof STRATEGY.pair_splitting];
      return row[dk] as StrategyCode;
    }
  }

  return getHardSoftAction(playerHand, dealerUpcard);
}

function isActionCorrect(code: StrategyCode, action: UserAction, doubleAvailable: boolean): boolean {
  switch (code) {
    case "H":  return action === "hit";
    case "S":  return action === "stand";
    case "D":  return doubleAvailable ? action === "double" : action === "hit";
    case "Ds": return doubleAvailable ? action === "double" : action === "stand";
    default:   return false;
  }
}

function resolvedLabel(code: StrategyCode, doubleAvailable: boolean): string {
  switch (code) {
    case "H":  return "Hit";
    case "S":  return "Stand";
    case "D":  return doubleAvailable ? "Double" : "Hit (no double)";
    case "Ds": return doubleAvailable ? "Double" : "Stand (no double)";
    default:   return code;
  }
}

const USER_ACTION_LABELS: Record<UserAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
};

export interface DecisionResult {
  correct: boolean;
  recommended: StrategyCode;
  message: string;
}

export function evaluateDecision(
  playerHand: Card[],
  dealerUpcard: Card,
  userAction: UserAction,
  doubleAvailable: boolean
): DecisionResult {
  const recommended = getBasicStrategyAction(playerHand, dealerUpcard);
  const isPairCode = recommended === "Y" || recommended === "N" || recommended === "Y/N";

  if (!isPairCode) {
    const correct = isActionCorrect(recommended, userAction, doubleAvailable);
    const recLabel = resolvedLabel(recommended, doubleAvailable);
    const message = correct
      ? `✓ Correct — ${recLabel}`
      : `✗ Should ${recLabel} — you ${USER_ACTION_LABELS[userAction]}`;
    return { correct, recommended, message };
  }

  // Pair situation: evaluate H/S/D against the hard/soft fallback.
  const fallback = getHardSoftAction(playerHand, dealerUpcard);
  const correct = isActionCorrect(fallback, userAction, doubleAvailable);
  const fallbackLabel = resolvedLabel(fallback, doubleAvailable);

  const pairNote =
    recommended === "Y"   ? "Ideally Split" :
    recommended === "Y/N" ? "Split if DAS offered" :
                            "Don't Split";

  const message = correct
    ? `✓ Correct — ${fallbackLabel} (${pairNote})`
    : `✗ Should ${fallbackLabel} — you ${USER_ACTION_LABELS[userAction]} (${pairNote})`;

  return { correct, recommended, message };
}
