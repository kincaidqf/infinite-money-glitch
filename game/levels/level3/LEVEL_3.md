# Level 3 — Running Count & True Count

---

## Overview

| Field | Value |
|---|---|
| Level ID | 3 |
| Title | Running Count & True Count |
| Description | Maintain the Hi-Lo running count, convert it to a true count, and identify index play opportunities. |
| Pass Criteria | 5 correct decisions in a row |
| Files owned | `game/levels/level3/**` + `components/levels/Level3Session.tsx` |

---

## Learning Goals

What the player should understand by the end of this level:

1. How to maintain an accurate Hi-Lo running count across all dealt cards
2. How to convert the running count to a true count: `TC = RC ÷ decks remaining`
3. When the true count triggers an Illustrious 18 index deviation from Basic Strategy

What this level explicitly does NOT cover:

- Bet sizing based on true count — first introduced in Level 4
- Bankroll management or Kelly Criterion — Level 4 only
- Card classification drill (covered in Level 2)

---

## Game Mechanics

### Player Actions Available
- [x] Hit
- [x] Stand
- [x] Double Down
- [x] Split
- [ ] Surrender
- [x] Count input field — player manually enters their running count after each round

### Win / Progression Condition

Player achieves 5 correct decisions in a row within a single session. A correct decision means both:
1. The playing action (hit / stand / double / split) matches Basic Strategy or the applicable index deviation
2. The count entry submitted that round is within ±1 of the actual running count

### State Shape (`Level3State`)

```ts
export interface Level3State {
  phase: "dealing" | "player-turn" | "dealer-turn" | "count-entry" | "round-over" | "session-over";
  playerHand: Card[];
  dealerHand: Card[];
  runningCount: number;           // Actual Hi-Lo running count maintained by game engine
  trueCount: number;              // runningCount ÷ decks remaining (floored to 1 decimal)
  playerEnteredCount: number | null; // Count value the player submitted this round
  correctCountEntries: number;    // Cumulative rounds where player count was within ±1
  totalCountEntries: number;      // Cumulative rounds where player submitted a count
  correctDecisions: number;       // Cumulative correct playing actions
  totalDecisions: number;         // Cumulative playing decisions made
  consecutiveCorrectDecisions: number; // Current streak — resets to 0 on any wrong decision
  missedIndexPlays: number;       // Rounds where an index deviation applied but player used Basic Strategy
  sessionComplete: boolean;
  lastFeedback: string | null;
}
```

---

## Probability / Math Component

### Concept Being Taught

How the proportion of high vs. low cards remaining in the shoe shifts expected value, and how to quantify that shift as a true count to trigger index deviations.

### Required Calculations

#### `getTrueCount`

- **Purpose:** Convert the running count to a per-deck normalized value for index play decisions
- **Inputs:** `runningCount: number, decksRemaining: number`
- **Output:** `number` — true count rounded to one decimal place
- **Formula:**
  ```
  trueCount = runningCount / decksRemaining
  Round to one decimal place.
  If decksRemaining < 0.5, clamp to 0.5 to avoid divide-by-near-zero.
  ```
- **Edge cases:** `decksRemaining <= 0` → return `runningCount` (treat as 1 deck)

#### `getIndexPlay`

- **Purpose:** Determine whether the current true count overrides Basic Strategy (Illustrious 18)
- **Inputs:** `playerTotal: number, dealerUpcard: number, isSoftHand: boolean, trueCount: number`
- **Output:** `string | null` — the override action (`"stand"`, `"double"`, `"take-insurance"`) or `null` if no deviation applies
- **Formula / Algorithm:**
  ```
  Illustrious 18 deviations (subset implemented for Level 3):

  Insurance:            trueCount >= +3  → take insurance
  16 vs 10:             trueCount >= 0   → stand (instead of hit)
  15 vs 10:             trueCount >= +4  → stand
  10 vs 10:             trueCount >= +4  → double
  10 vs Ace:            trueCount >= +4  → double
  12 vs 3:              trueCount >= +2  → stand
  12 vs 2:              trueCount >= +3  → stand
  11 vs Ace:            trueCount >= +1  → double
  9 vs 2:               trueCount >= +1  → double
  9 vs 7:               trueCount >= +3  → double

  Return the override action for the first matching rule, or null.
  ```
- **Edge cases:** Soft hands — isSoftHand=true bypasses hard-total rules

### How Math Results Surface in the UI

- True count is displayed as a read-only value **after** the player submits their count entry, not before
- If an index deviation was available and the player missed it, the post-round feedback panel flags it: "Index play available: stand 12 vs. 3 (TC was +2)"
- Running count is never shown to the player during play — they must track it themselves

---

## Tutor Prompts

All three prompts live in `tutorPrompts.ts` and follow Role / Scope / Format / Constraint.

### `feedback` prompt

```
Role: Expert Blackjack card counting tutor evaluating count entry and playing decision
Scope: Hi-Lo running count, true count (RC ÷ decks remaining), Illustrious 18 index deviations — no bet sizing
Format: 2-3 sentences, plain text, cite actual RC and TC values from game state
Constraint: Do not reveal next correct action directly; guide with reasoning. No bet sizing.
```

### `hint` prompt

```
Role: Expert Blackjack card counting tutor giving a focused nudge
Scope: Count accuracy or index deviation trigger at current true count
Format: 1-2 sentences, plain text
Constraint: Do not reveal exact count or correct action — prompt player to recount a segment or reconsider decks remaining
```

### `explanation` prompt

```
Role: Expert Blackjack card counting tutor explaining a concept
Scope: Hi-Lo running count, true count formula, deck estimation, Illustrious 18 — no bet sizing
Format: 3-4 sentences, plain text, with a numeric example
Constraint: Stay on the asked concept; no bankroll or bet-sizing advice
```

### What game state must be included in every LLM call

`getLevel3GameContext(state)` must return a plain-English string containing:

- [x] Level number and title (`Level 3 — Running Count & True Count Mastery`)
- [x] Player hand (ranks)
- [x] Dealer upcard
- [x] Running count (actual)
- [x] True count (actual)
- [x] Player's entered count for this round
- [x] Count accuracy: correct entries / total entries (%)
- [x] Decision accuracy: correct decisions / total decisions (%)
- [x] Consecutive correct decisions (current streak)
- [x] Missed index plays (cumulative)
- [x] Current phase

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Determining player total for index play lookup |
| `isSoft` | `@/game/cardUtils` | Distinguishing soft vs. hard totals in index play rules |
| `isBust` | `@/game/cardUtils` | Detecting bust after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Baseline correct action before index override |
| `evaluateDecision` | `@/game/basicStrategy` | Checking player action against correct action |
| `initShoe` | `@/game/deckState` | Initializing the shoe at session start |
| `dealCard` | `@/game/deckState` | Dealing cards and updating running count |
| `getTrueCount` | `@/game/deckState` | Converting RC to TC after each round |

---

## Out-of-Scope Guardrails

The tutor and game logic for Level 3 must never:

- [x] Suggest bet sizing changes based on count
- [x] Reference Kelly Criterion or bankroll management
- [x] Introduce concepts from Level 4
- [x] Reveal the running or true count to the player during the decision phase
- [x] Reveal the correct action before the player has decided
- [x] Send player PII to the LLM

---

## Implementation Checklist

### `gameLogic.ts`
- [ ] `Level3State` interface includes `consecutiveCorrectDecisions`
- [ ] `getInitialLevel3State()` initializes `consecutiveCorrectDecisions: 0`
- [ ] `getLevel3GameContext(state)` includes streak and all count fields
- [ ] `getTrueCount(rc, decksRemaining)` implemented as pure function
- [ ] `getIndexPlay(playerTotal, dealerUpcard, isSoft, trueCount)` implements Illustrious 18 subset
- [ ] Pass condition: `consecutiveCorrectDecisions >= 5` sets `sessionComplete: true`
- [ ] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [x] `feedback` prompt written and reviewed
- [x] `hint` prompt written and reviewed
- [x] `explanation` prompt written and reviewed
- [x] All prompts specify Role / Scope / Format / Constraint
- [x] No bet sizing or Level 4 content in any prompt

### `index.ts`
- [x] `config.passCriteria` updated to "5 correct decisions in a row"

### `Level3Session.tsx`
- [ ] Count input field renders during `count-entry` phase
- [ ] True count revealed only after count is submitted
- [ ] Missed index play flagged in post-round feedback panel
- [ ] Session complete screen shows streak, count accuracy, and decision accuracy
- [ ] Handles LLM error gracefully

### Manual QA
- [ ] Level loads without errors
- [ ] Streak counter resets on wrong decision
- [ ] Session completes after 5 consecutive correct decisions
- [ ] True count not visible before player submits count
- [ ] No API key visible in network tab or source
