# Level 1 — Basic Strategy & Dealer Probability

---

## Overview

| Field | Value |
|---|---|
| Level ID | 1 |
| Title | Basic Strategy |
| Description | Learn when to hit or stand by understanding why the dealer's upcard changes your odds. |
| Pass Criteria | 5 correct Basic Strategy decisions in a row |
| Files owned | `game/levels/level1/**` + `components/levels/Level1Session.tsx` |

---

## Learning Goals

What the player should understand by the end of this level:

1. **Basic gameplay** — How a blackjack hand is dealt, how hand values are calculated, and what Hit/Stand mean.
2. **Dealer bust probability** — Why the dealer's upcard (before any actions are taken) determines the probability that the dealer will bust, and how to read that probability as a guide for your own decision.
3. **Basic Strategy decisions** — How to use the dealer's bust likelihood to decide whether to hit or stand on a given hand total.

What this level explicitly does NOT cover:

- Card counting or running/true count — first introduced in Level 2.
- Bet sizing — not covered until Level 3.
- Double Down and Split decisions — kept out of scope to reduce cognitive load for beginners.
- Index plays or count-dependent deviations from Basic Strategy.

---

## Game Mechanics

### Player Actions Available
- [x] Hit
- [x] Stand
- [ ] Double Down — out of scope for Level 1
- [ ] Split — out of scope for Level 1
- [ ] Surrender

### Session Flow

Level 1 uses a **tutor-gated cycle**. The player cannot skip the tutor interactions.

```
1. TUTOR INTRO   — Tutor explains the round's concept before cards are dealt.
                   Player must read and acknowledge before proceeding.
2. GAME ROUND    — A single hand is dealt. Player chooses Hit or Stand.
                   Dealer plays out. Outcome is shown.
3. TUTOR FEEDBACK — Tutor evaluates the decision (correct/incorrect),
                   references the dealer's bust probability, and explains
                   the reasoning. Player must read and acknowledge.
4. Repeat steps 1–3 until the player achieves 5 correct decisions in a row.
5. SESSION OVER  — Level complete. Level 2 is unlocked.
```

The tutor intro (step 1) focuses on the dealer's upcard and its associated bust probability **before** the player acts, so the player learns to consult probability prior to deciding.

### Win / Progression Condition

The player must make **5 consecutive correct Basic Strategy decisions** (Hit or Stand only). Any incorrect decision resets `consecutiveCorrect` to 0. The session is complete when `consecutiveCorrect` reaches 5.

### State Shape (`Level1State`)

```ts
export interface Level1State {
  // Core phases
  phase:
    | "tutor-intro"      // Tutor speaks before the hand; player must acknowledge
    | "dealing"          // Cards being dealt (brief transition)
    | "player-turn"      // Player chooses Hit or Stand
    | "dealer-turn"      // Dealer plays out automatically
    | "round-over"       // Outcome shown; awaiting tutor feedback step
    | "tutor-feedback"   // Tutor evaluates decision; player must acknowledge
    | "session-over";    // 5-in-a-row achieved; level complete

  // Hands
  playerHand: Card[];
  dealerHand: Card[];          // dealerHand[0] is the upcard; [1] is hole card (face-down until dealer-turn)

  // Decision tracking
  correctDecisions: number;        // Total correct decisions this session
  totalDecisions: number;          // Total decisions made this session
  consecutiveCorrect: number;      // Resets to 0 on any wrong decision
  lastDecisionCorrect: boolean | null;
  sessionComplete: boolean;

  // Tutor state
  lastFeedback: string | null;     // Most recent LLM response text
  tutorAcknowledged: boolean;      // True once player clicks "Got it" / "Continue"

  // Probability display (computed, not persisted — recalculate from dealerHand)
  dealerBustProbability: number | null;  // 0–1; shown in header after cards are dealt
}
```

---

## Probability / Math Component

### Concept Being Taught

Before a player acts, they should look at the dealer's visible upcard and estimate how likely the dealer is to bust if the player does nothing. A high dealer bust probability (e.g., dealer shows 6) suggests the player can stand safely on stiff totals. A low dealer bust probability (e.g., dealer shows Ace) suggests the player should hit to improve their hand.

### Required Calculations

#### `getDealerBustProbability`

- **Purpose:** Returns the probability that the dealer busts, given only their upcard, using standard 6-deck Basic Strategy dealer rules (dealer hits soft 17). This is the core number shown to the player in Level 1.
- **Inputs:** `dealerUpcard: Card`
- **Output:** `number` between 0–1 (e.g., `0.42` for dealer showing 6)
- **Formula / Algorithm:**
  ```
  Use a lookup table derived from multi-deck dealer simulation.
  Dealer bust probabilities by upcard (6-deck, dealer hits soft 17):

    Upcard   Bust %
    2        35.3%  → 0.353
    3        37.6%  → 0.376
    4        40.3%  → 0.403
    5        42.9%  → 0.429
    6        42.3%  → 0.423
    7        26.2%  → 0.262
    8        24.4%  → 0.244
    9        23.0%  → 0.230
    10/J/Q/K 21.4%  → 0.214
    Ace      11.7%  → 0.117

  Return the table value for the upcard rank.
  Map J, Q, K → "10" before lookup.
  ```
- **Edge cases:** If `dealerHand` is empty or upcard is undefined, return `null`. The UI must handle `null` gracefully (display "—" rather than a percentage).

#### `getBasicStrategyActionLevel1`

- **Purpose:** Returns the correct Basic Strategy action (Hit or Stand) for a given player total and dealer upcard. Level 1 restricts to Hit/Stand only — Double and Split decisions are mapped to their Basic Strategy equivalent action for simplicity.
- **Inputs:** `playerTotal: number, isSoft: boolean, dealerUpcard: Card`
- **Output:** `"hit" | "stand"`
- **Formula / Algorithm:**
  ```
  Delegate to the shared `getBasicStrategyAction` from `@/game/basicStrategy`.
  If the returned action is "double", map to "hit" (doubling down is not
  available in Level 1, but the correct decision is still to take a card).
  If the returned action is "split", evaluate the split hand as a hard total
  and return the Basic Strategy hit/stand for that total.
  ```
- **Edge cases:** Soft aces handled by the `isSoft` flag. Blackjack (21 on two cards) auto-stands — no decision presented to player.

#### `isConsecutiveWin`

- **Purpose:** Determines whether the level pass condition has been met.
- **Inputs:** `consecutiveCorrect: number`
- **Output:** `boolean`
- **Formula / Algorithm:**
  ```
  return consecutiveCorrect >= 5
  ```
- **Edge cases:** None.

### How Math Results Surface in the UI

- `dealerBustProbability` is displayed in the **header "Probability" section** as a percentage (e.g., "Dealer bust chance: 42%") as soon as the deal phase begins — before the player has acted.
- The probability is **not hidden** before the player decides in Level 1. Showing it explicitly is the pedagogical goal: the player should learn to consult it.
- After the round, the tutor's feedback message **references the displayed probability** to explain why the correct decision follows from it.
- The consecutive correct streak is shown as a visual indicator (e.g., "Streak: 3 / 5") below the action buttons.

---

## Tutor Prompts

All three prompt strings go in `tutorPrompts.ts` following the four-part structure: **Role / Scope / Format / Constraint**.

### `feedback` prompt

```
Role: Expert blackjack Basic Strategy tutor for a complete beginner.
Scope: Hit/Stand decisions only, dealer bust probability by upcard, basic hand values.
       Do NOT mention card counting, running count, true count, bet sizing, Double Down, or Split.
Format: 3–4 sentences, plain text, warm and encouraging tone.
        Always reference the dealer's bust probability displayed to the player.
Constraint: Reveal whether the decision was correct, explain why using dealer bust probability,
            and close with one reinforcing principle. Never give away the next hand's correct action.
```

Full prompt text:

```
You are a patient and encouraging blackjack Basic Strategy tutor working with a complete beginner. Your job is to evaluate the player's most recent Hit or Stand decision, explain whether it was correct, and connect the reasoning to the dealer's bust probability — the one number shown to the player before they acted.

Keep your feedback to 3–4 sentences of plain text. Always start by stating whether the decision was correct or incorrect. Then explain the reasoning using the dealer's upcard and bust probability (provided in the game context below). Close with one short reinforcing principle the player can carry to the next hand. Do not mention card counting, running count, true count, Double Down, Split, or bet sizing under any circumstances. Do not reveal what the correct action will be on the next hand.
```

### `hint` prompt

```
Role: Expert blackjack Basic Strategy tutor for a complete beginner.
Scope: Dealer bust probability and its relationship to Hit/Stand decisions only.
Format: 1–2 sentences, plain text, Socratic — ask a guiding question rather than stating the answer.
Constraint: Do not state the correct action directly. Point the player toward the dealer's bust probability.
```

Full prompt text:

```
You are a blackjack Basic Strategy tutor helping a beginner think through their next decision. Give a 1–2 sentence hint that directs the player's attention to the dealer's upcard and its bust probability without stating the correct action. Ask a guiding question rather than giving the answer. Do not mention card counting, running count, true count, Double Down, Split, or bet sizing.
```

### `explanation` prompt

```
Role: Expert blackjack Basic Strategy tutor introducing a concept before a hand is played.
Scope: Dealer bust probabilities by upcard category (strong vs. weak), and how they map to Hit/Stand.
Format: 3–5 sentences, plain text, introductory and clear. Use one concrete example.
Constraint: Teach only the concept relevant to the upcoming hand. Do not mention counting, bet sizing,
            Double Down, or Split. Do not reveal the correct action for the upcoming hand.
```

Full prompt text:

```
You are a blackjack Basic Strategy tutor introducing a key concept to a beginner before they play a hand. Write 3–5 sentences of plain text that explain the dealer bust probability concept relevant to this hand, using the dealer's upcard shown in the game context below. Categorize the dealer upcard as either "strong" (7 through Ace, lower bust chance) or "weak" (2 through 6, higher bust chance) and explain what that means for the player's strategy. Use one concrete example. Do not reveal the correct action for the current hand, and do not mention card counting, running count, true count, Double Down, Split, or bet sizing.
```

### What game state must be included in every LLM call

`getLevel1GameContext()` in `gameLogic.ts` must return a plain-English string containing:

- [x] Level number and title
- [x] Player hand (ranks and total)
- [x] Dealer upcard (rank only — hole card stays hidden until dealer-turn)
- [x] Dealer bust probability for the upcard (percentage)
- [x] Current phase
- [x] Consecutive correct streak (`consecutiveCorrect` / 5)
- [x] Decisions correct / total this session
- [x] Whether the last decision was correct (for feedback calls only)

Example output:
```
Level 1 — Basic Strategy
Player hand: 8, 7 (total: 15, hard)
Dealer upcard: 6 (bust probability: 42%)
Phase: tutor-feedback
Last decision: Stand — INCORRECT
Streak: 2 consecutive correct (need 5 to pass)
Session: 4/7 correct decisions
```

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Computing player and dealer totals |
| `isSoft` | `@/game/cardUtils` | Determining if player hand is soft (affects Basic Strategy lookup) |
| `isBust` | `@/game/cardUtils` | Detecting bust after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Looking up correct Hit/Stand/Double/Split action |
| `evaluateDecision` | `@/game/basicStrategy` | Comparing player's action against correct action |
| `initShoe` | `@/game/deckState` | Initializing the 6-deck shoe at session start |
| `dealCard` | `@/game/deckState` | Dealing cards one at a time |

`getProbabilities` from `@/game/deckState` is NOT used — Level 1 uses a fixed upcard lookup table (`getDealerBustProbability`) instead of shoe-composition-aware probabilities, keeping the concept simple for beginners.

---

## Out-of-Scope Guardrails

The tutor and game logic for this level must never:

- [x] Mention card counting, running count, or true count in any LLM response or UI text
- [x] Display count-related UI elements (count input, running count display)
- [x] Offer Double Down or Split as player actions
- [x] Suggest bet sizing changes
- [x] Reference content from Level 2 or higher
- [x] Reveal the correct action before the player has decided (hints must use Socratic questioning only)
- [x] Send player PII to the LLM
- [x] Allow the player to skip the tutor intro or tutor feedback steps

---

## Implementation Checklist

### `gameLogic.ts`
- [ ] `Level1State` interface defined (including `consecutiveCorrect`, `tutorAcknowledged`, `dealerBustProbability`, and the extended `phase` enum)
- [ ] `getInitialLevel1State()` implemented — starts at `phase: "tutor-intro"`
- [ ] `getLevel1GameContext(state)` returns complete plain-English summary per spec above
- [ ] `getDealerBustProbability(dealerUpcard)` implemented using lookup table
- [ ] `getBasicStrategyActionLevel1(playerTotal, isSoft, dealerUpcard)` implemented (maps Double→Hit, Split→equivalent hard total)
- [ ] `isConsecutiveWin(consecutiveCorrect)` implemented
- [ ] Consecutive streak resets to 0 on any incorrect decision
- [ ] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [ ] `feedback` prompt written and reviewed
- [ ] `hint` prompt written and reviewed
- [ ] `explanation` prompt written and reviewed
- [ ] All prompts specify Role / Scope / Format / Constraint
- [ ] No counting, bet sizing, Double Down, or Split references in any prompt

### `index.ts`
- [ ] `config.passCriteria` updated to reflect "5 correct decisions in a row" (overrides the default ≥70% shoe metric)
- [ ] `LevelModule` satisfies `lib/levelInterface.ts` contract

### `Level1Session.tsx`
- [ ] Tutor intro phase renders tutor message with "Continue" button; game controls are disabled
- [ ] Dealing phase deals 2 cards to player, 1 upcard + 1 face-down to dealer
- [ ] Player-turn phase shows dealer bust probability in header, enables Hit/Stand buttons
- [ ] Dealer-turn phase reveals hole card, dealer auto-hits until 17+
- [ ] Round-over phase shows outcome and transitions to tutor-feedback (tutor controls disabled)
- [ ] Tutor-feedback phase renders tutor message with "Got it" button; game controls are disabled
- [ ] Consecutive streak indicator ("Streak: N / 5") visible during player-turn and round-over phases
- [ ] `dealerBustProbability` displayed in header as "Dealer bust chance: X%" during player-turn phase
- [ ] Session-over phase displays pass message and "Unlock Level 2" CTA
- [ ] Tutor hint button available during player-turn phase only
- [ ] Handles LLM error gracefully — shows "Tutor unavailable. Try again." without crashing

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor intro fires before first hand and cannot be skipped
- [ ] Tutor feedback fires after each hand and cannot be skipped
- [ ] Dealer bust probability displays correctly for each upcard category
- [ ] Streak resets on incorrect decision
- [ ] Session completes at exactly 5 consecutive correct decisions
- [ ] Level 2 unlocks after session complete
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
