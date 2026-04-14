# Level 1 — Probability Basics

---

## Overview

| Field | Value |
|---|---|
| Level ID | 1 |
| Title | Probability Basics |
| Description | Learn why 31% of cards are worth 10 points and how that single probability shapes every hit/stand decision. |
| Pass Criteria | 5 consecutive correct probability-based hit/stand decisions in a row |
| Files owned | `game/levels/level1/**` + `components/levels/Level1Session.tsx` |

---

## Pedagogical Goal

This level teaches **probability reasoning through blackjack** — not blackjack rules. The game is the medium, not the subject. A player who completes Level 1 should be able to answer:

> "In a fresh 52-card deck, what is the probability that the next card is a 10-value? How does that single number explain why a player with 16 against a dealer 6 should stand?"

They should arrive at those answers through reasoning, not memorization.

---

## Learning Goals

What the player should understand by the end of this level:

1. **The 31% ten-value probability** — A standard deck has 16 cards worth 10 points (four 10s, four Jacks, four Queens, four Kings). That is 16/52 ≈ 31% — the single most important probability in blackjack.
2. **Player bust risk as a function of hard total** — Given a hard total, the player can calculate the fraction of the deck that would cause a bust if they hit. This is derived directly from the 31% ten-value rate.
3. **How the 31% rate predicts the dealer's hole card** — When the dealer shows a weak upcard (2–6), their hidden card is most likely a 10-value (~31% prior), giving them roughly a 15 or 16. Since they must hit below 17, they then face a ~46–62% chance of busting on that hit.
4. **Two-number decision framework** — Every hit/stand decision reduces to comparing two probabilities: (1) the player's bust risk if they hit, and (2) the dealer's probability of busting without the player's help.

What this level explicitly does NOT cover:

- Card counting or running/true count — first introduced in Level 2.
- Bet sizing — not covered until Level 3.
- Double Down and Split — out of scope to reduce cognitive load.
- Shoe-composition-aware probability (no counting) — all probabilities in Level 1 assume a fresh 52-card deck.

---

## Game Mechanics

### Player Actions Available
- [x] Hit
- [x] Stand
- [ ] Double Down — out of scope for Level 1
- [ ] Split — out of scope for Level 1
- [ ] Surrender

### Session Flow

Level 1 uses a **5-stage progression**. The player cannot skip tutor interactions.

```
Stage 1 — Introduction (tutor-intro)
  Tutor explains the 31% ten-value probability via the sidebar.
  Player reads and clicks "Let's Play" to proceed.

Stage 2 — Free Play (3 hands)
  Player plays 3 hands with no feedback on decisions.
  Probability HUD (P(Ten-Value), Bust If Hit, Dealer Bust) is visible from the start.
  Player can use the sidebar chat to ask probability questions.
  After 3 hands → advance to Stage 3.

Stage 3 — Probability Chain (tutor-intro)
  Tutor explains how the 31% rate predicts the dealer's hole card and the
  probability chain that leads to dealer busts. Player clicks "Got it" to proceed.

Stage 4 — Guided Hands (3 hands)
  Tutor gives a pre-play probability framework intro.
  After each hand → tutor-feedback: tutor evaluates the decision using
  the actual bust probabilities shown in the HUD.
  Player must read and click "Got it" before the next hand.

Stage 5 — Free Play with Streak (blocks of 5 hands)
  Player plays until they achieve 5 consecutive correct decisions.
  After each 5-hand block → tutor-feedback summary.
  "Get Hint" and sidebar chat remain available throughout.
  5 consecutive correct decisions → session complete.
```

### Tutor Sidebar

The tutor panel is always visible on the right side of the screen. It is never a fullscreen modal. This means:

- During forced tutor phases (`tutor-intro`, `tutor-feedback`): the sidebar shows the tutor message and an acknowledge button ("Got it" / "Let's Play"). The Hit/Stand buttons on the game board are disabled, but the game board remains visible so the player can read the hand while absorbing the tutor's explanation.
- During free play (`player-turn`, `round-over`): the sidebar shows a "Get Hint" button and a text input for the student to ask any probability question. Tutor responses accumulate as a scrolling conversation history.

### Win / Progression Condition

The player must make **5 consecutive correct hit/stand decisions** (correctness measured against Basic Strategy). Any incorrect decision resets `consecutiveCorrect` to 0. The session is complete when `consecutiveCorrect` reaches 5.

### State Shape (`Level1State`)

```ts
export interface Level1State {
  stage: 1 | 2 | 3 | 4 | 5;
  phase:
    | "tutor-intro"      // Tutor speaks in sidebar; player must acknowledge before acting
    | "player-turn"      // Player chooses Hit or Stand; sidebar chat and hint available
    | "dealer-turn"      // Dealer plays out automatically
    | "round-over"       // Outcome shown; stages 2 uses manual "Next Hand", 4–5 auto-advance
    | "tutor-feedback"   // Tutor evaluates decision in sidebar; player must acknowledge
    | "session-over";    // 5-in-a-row achieved; level complete

  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];       // [0] = upcard (visible); [1] = hole card (hidden until dealer-turn)

  // Decision tracking
  correctDecisions: number;
  totalDecisions: number;
  consecutiveCorrect: number;       // Resets to 0 on any incorrect decision
  lastDecisionCorrect: boolean | null;
  sessionComplete: boolean;
  lastOutcome: "win" | "loss" | "push" | null;
  firstActionDone: boolean;

  // Session stats
  sessionWins: number;
  sessionLosses: number;

  // Probability display (computed each time the hand changes)
  dealerBustProbability: number | null;   // Lookup table by upcard; shown in HUD during player-turn
  playerBustProbability: number | null;   // Fresh-deck calculation; shown as "Bust If Hit" in HUD

  // Stage progression counters
  stage2HandsPlayed: number;
  stage4HandsPlayed: number;
  stage4IntroShown: boolean;
  stage5BlockHandsPlayed: number;
}
```

---

## Probability / Math Component

### Core Teaching Concept

There is one foundational probability in this level: **16/52 ≈ 31% of cards in a fresh deck are worth 10 points** (10, J, Q, K — four of each across four suits). Every other probability calculation in this level flows from that number.

The level never adjusts probabilities based on cards dealt (no counting). This is intentional — the goal is to internalize the fresh-deck baseline before introducing shoe-composition effects in later levels.

### Required Calculations

#### `TEN_VALUE_PROBABILITY`

- **Purpose:** The constant 31% displayed in the HUD throughout the entire level. Acts as a persistent anchor that the player learns to reference.
- **Value:** `16 / 52`
- **Note:** This is exported as a named constant, not a function. The UI always displays it as "31%" regardless of game state.

#### `getPlayerBustProbability(hand)`

- **Purpose:** Answers "If I hit right now, what fraction of cards in a fresh deck would cause me to bust?" Shown in the HUD as "Bust If Hit" during `player-turn` phase.
- **Inputs:** `hand: Card[]`
- **Output:** `number` between 0–1, or `null` if hand is empty
- **Algorithm:**
  ```
  If hand is empty: return null
  If hand is soft (has a usable ace): return 0
    — An ace can always absorb one additional card as value 1, so no single
      card can bust a soft hand. This is a direct consequence of the 31% rule.
  
  Compute hard total = calculateHandValue(hand)
  If total <= 11: return 0   (no card can bust you)
  If total > 21:  return 1   (already busted)
  
  Return PLAYER_BUST_PROB[total] using this lookup table:
    Hard 12 → 16/52  (only 10-value cards bust you; ~31%)
    Hard 13 → 20/52  (9 through K bust you; ~38%)
    Hard 14 → 24/52  (8 through K; ~46%)
    Hard 15 → 28/52  (7 through K; ~54%)
    Hard 16 → 32/52  (6 through K; ~62%)
    Hard 17 → 36/52  (5 through K; ~69%)
    Hard 18 → 40/52  (4 through K; ~77%)
    Hard 19 → 44/52  (3 through K; ~85%)
    Hard 20 → 48/52  (2 through K; ~92% — note: Ace to 20 = 21, NOT a bust)
    Hard 21 → 52/52  (every card busts you; 100%)
  ```
- **Edge cases:** Soft totals always return 0. After each Hit, recalculate with the updated hand. On bust, clear `playerBustProbability` to null (already busted, no further hit decisions).

#### `getDealerBustProbability(upcard)`

- **Purpose:** Answers "If the dealer plays out by the rules, what fraction of the time do they bust?" Shown in the HUD as "Dealer Bust" during `player-turn` phase.
- **Inputs:** `upcard: Card | undefined`
- **Output:** `number` between 0–1, or `null` if no upcard
- **Algorithm:**
  ```
  Fixed lookup table (6-deck, dealer hits soft 17 — derived from simulation):
    "2" → 0.353,  "3" → 0.376,  "4" → 0.403,  "5" → 0.429,  "6" → 0.423,
    "7" → 0.262,  "8" → 0.244,  "9" → 0.230,
    "10", "J", "Q", "K" → 0.214,
    "A" → 0.117
  ```
- **Edge cases:** Return `null` if upcard is undefined. Map J, Q, K to the "10" entry.
- **Teaching connection:** The 31% ten-value rate explains why 2–6 are "weak" — the dealer's hidden card is likely a 10-value, leaving them with 12–16. They must hit, and there's a high probability the next card causes a bust.

#### `getBasicStrategyActionLevel1(playerTotal, soft, dealerUpcard, playerHand)`

- **Purpose:** Returns the correct decision for evaluating whether the player's choice was right. Not shown directly to the player — used only to determine `lastDecisionCorrect`.
- **Inputs:** `playerTotal: number, soft: boolean, dealerUpcard: Card, playerHand: Card[]`
- **Output:** `"hit" | "stand"`
- **Algorithm:**
  ```
  Delegate to shared getBasicStrategyAction(playerHand, dealerUpcard).
  Map non-hit/stand codes: "D"/"Ds" → "hit", pair codes → hard total evaluation.
  ```

### How Probability Results Surface in the UI

All three probability stats are displayed in the **top-left HUD** during `player-turn` phase:

```
Stage | P(Ten-Value) 31% | Bust If Hit: X% | Dealer Bust: X%
```

- **P(Ten-Value)** — Always shown at 31%, every stage, every phase. Its persistence is intentional: the player should internalize it as a constant before using it in calculations.
- **Bust If Hit** — Shown in red when ≥50% (high risk), green when <50% (lower risk). Only visible during `player-turn` when a hand is active.
- **Dealer Bust** — Always green (it's a probability in the player's favor). Only visible during `player-turn`.

The tutor sidebar's feedback always references these numbers by name, connecting the HUD values to the reasoning. The tutor never says "you should have stood" without citing the probability that explains why.

---

## Tutor Prompts

### `feedback` prompt (what goes in `tutorPrompts.ts`)

```
Role: Patient blackjack probability tutor for a beginner.
Scope: Evaluating hit/stand decisions through probability reasoning only.
       Reference player bust probability if hitting, dealer bust probability,
       and the 31% ten-value rate from the game context.
Format: 3–4 sentences, plain text, warm tone.
        Start with correct/incorrect verdict. Cite specific probabilities.
        Close with one probability-based principle.
Constraint: No card counting, no running/true count, no Double Down,
            no Split, no bet sizing. No next-hand spoilers.
```

### `hint` prompt

```
Role: Blackjack probability tutor during active player decision.
Scope: Guide player toward the two key probabilities: their own bust risk
       and the dealer's bust probability. Never state the correct action.
Format: 1–2 sentences, Socratic — ask a guiding question using the numbers
        shown in the HUD.
Constraint: No card counting, no running/true count, no Double Down, no Split,
            no bet sizing. Do not state the correct action directly.
```

### `explanation` prompt (handles both stage intros and student chat questions)

```
Role: Blackjack probability tutor introducing concepts or answering questions.
Scope: Always centers on probability — especially the 31% ten-value rate.
       Handles both pre-hand stage introductions and free-form student questions.
Format: 2–4 sentences, plain text. For student questions: answer the question
        directly, then connect it to probability.
Constraint: No card counting, no running/true count, no Double Down,
            no Split, no bet sizing.
```

### What game state must be included in every LLM call

`getLevel1GameContext(state)` must return:

- Level number and pedagogical framing ("Level 1 — Probability & Blackjack")
- The 31% constant as context ("~31% chance any card drawn is a 10-value")
- Player hand (ranks + total + soft/hard label)
- Player bust probability if hitting (as a percentage)
- Dealer upcard (rank + dealer bust probability as a percentage)
- Current phase
- Last decision result (CORRECT / INCORRECT / none yet)
- Consecutive correct streak (N / WIN_STREAK)
- Session accuracy (correct / total)

Example output:
```
Level 1 — Probability & Blackjack
Key probability: ~31% chance any card drawn is a 10-value (10, J, Q, K — 16 out of 52 cards)
Player hand: 8, 7 (total: 15, hard)
Player bust probability if hitting: 54%
Dealer upcard: 6 (dealer bust probability: 42%)
Phase: tutor-feedback
Last decision: INCORRECT
Streak: 2 consecutive correct (need 5 to pass)
Session: 4/7 correct decisions
```

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Player and dealer totals |
| `isSoft` | `@/game/cardUtils` | Detecting soft hands (bust probability = 0 when soft) |
| `isBust` | `@/game/cardUtils` | Detecting bust after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Evaluating decision correctness |
| `initShoe` | `@/game/deckState` | Initializing 6-deck shoe |
| `dealCard` | `@/game/deckState` | Dealing cards |

`getProbabilities` from `@/game/deckState` is NOT used — Level 1 intentionally uses fresh-deck composition lookup tables to teach the baseline probability before introducing shoe-state-aware math in later levels.

---

## Out-of-Scope Guardrails

The tutor and game logic for this level must never:

- [x] Mention card counting, running count, or true count
- [x] Display any count-related UI elements
- [x] Offer Double Down or Split as player actions
- [x] Suggest bet sizing changes
- [x] Adjust probabilities based on cards already dealt (no counting)
- [x] Reference content from Level 2 or higher
- [x] Reveal the correct action before the player has decided
- [x] Send player PII to the LLM
- [x] Allow the player to skip tutor interactions (intro or feedback)

---

## Implementation Checklist

### `gameLogic.ts`
- [x] `Level1State` interface defined with all fields including `playerBustProbability` and `stage`
- [x] `TEN_VALUE_PROBABILITY` exported as a named constant (`16 / 52`)
- [x] `getPlayerBustProbability(hand)` implemented — returns 0 for soft hands, lookup for hard totals, null when empty
- [x] `getDealerBustProbability(upcard)` implemented using lookup table
- [x] `getBasicStrategyActionLevel1(...)` implemented (maps Double→Hit, handles pair codes)
- [x] `isConsecutiveWin(consecutiveCorrect)` implemented
- [x] `getLevel1GameContext(state)` includes both bust probabilities and the 31% anchor
- [x] `getStageIntroContext(stage)` returns probability-focused prompts for stages 1, 3, 4
- [x] `playerBustProbability` recalculated on `startNewHand` and each `applyPlayerHit`
- [x] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [x] `feedback` prompt centers on citing bust probabilities
- [x] `hint` prompt uses Socratic questioning with HUD numbers
- [x] `explanation` prompt handles both stage intros and student chat questions
- [x] All prompts exclude card counting, bet sizing, Double Down, Split

### `index.ts`
- [x] Title: "Probability Basics"
- [x] Description reflects probability framing
- [x] `passCriteria` updated
- [x] `LevelModule` satisfies `lib/levelInterface.ts` contract

### `Level1Session.tsx`
- [x] `TutorOverlay` (fullscreen modal) removed; replaced with persistent `TutorSidebar`
- [x] Tutor sidebar always visible; never blocks the game board
- [x] During forced phases (`tutor-intro`, `tutor-feedback`): acknowledge button visible in sidebar; Hit/Stand disabled on game board
- [x] During `player-turn`: "Get Hint" button and chat input available in sidebar
- [x] Chat input allows student to ask free-form probability questions; responses add to message history
- [x] HUD shows P(Ten-Value) always; Bust If Hit + Dealer Bust during `player-turn`
- [x] Bust If Hit displayed in red when ≥50%, green when <50%
- [x] Streak indicator visible in Stage 5
- [x] Session-over screen references probability framing
- [x] LLM errors display "Tutor unavailable. Try again." without crashing

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor sidebar appears on the right and never covers the game board
- [ ] Stage 1 tutor intro fires before first hand; "Let's Play" advances to free play
- [ ] P(Ten-Value) shows 31% throughout all stages and phases
- [ ] Bust If Hit updates correctly after each Hit action
- [ ] Dealer Bust shows correct percentage per upcard
- [ ] Tutor feedback references the actual bust probabilities, not generic advice
- [ ] Chat input accepts a question and returns a probability-focused response
- [ ] Streak resets on incorrect decision
- [ ] Session completes at exactly 5 consecutive correct decisions
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
