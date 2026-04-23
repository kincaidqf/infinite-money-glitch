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
2. **Full bust / improvement spectrum** — For any hard total, the player should enumerate ALL card ranks that would bust them AND all ranks that would improve them. A hard 16 has 8 bust ranks (6–K = 32 cards = 62%), and a hard 12 has 9 improving rank groups (A + 2–9 = 36 cards = 69%). Students learn to count the full set, not just the worst or best card.
3. **How the 31% rate predicts the dealer's hole card** — When the dealer shows a weak upcard (2–6), their hidden card is most likely a 10-value (~31% prior), giving them roughly a 15 or 16. Since they must hit below 17, they then face a ~46–62% chance of busting on that hit.
4. **Two-number decision framework** — Every hit/stand decision reduces to comparing two probabilities: (1) the player's bust risk if they hit, and (2) the dealer's probability of busting without the player's help.
5. **Soft hand awareness** — A soft hand (one with a usable Ace) cannot bust on a single draw, but that alone does not mean hitting is always correct. A soft 19 should stand because only 4 out of 52 cards improve it to 21, and the hand is already strong.

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
  After each hand → tutor-feedback: tutor evaluates ALL decisions using
  the actual bust probabilities shown in the HUD, referencing the decision log.
  Player must read and click "Got it" before the next hand.

Stage 5 — Free Play with Streak (blocks of 5 hands)
  Player plays until they achieve 5 consecutive correct first-action decisions.
  ALL decisions per hand are tracked, not just the first.
  After each block of 5 hands → tutor-feedback with a block summary
    showing every hand's decisions and outcomes.
  Incorrect first-action decisions interrupt immediately with a probability quiz.
  "Get Hint" and sidebar chat remain available throughout.
  5 consecutive correct first-action decisions → session complete.
```

### Stage 5 — Probability Quiz Workflow

When a player makes an incorrect **first-action** decision in Stage 5, the game immediately interrupts with a probability quiz instead of advancing to the next hand. The quiz is specific to the type of error:

#### Wrong Hit on a Hard Hand (e.g., hitting hard 20)

A 3-part quiz walks the student through computing the full probability space:

```
Part 1: "With a hard [total], how many different card ranks in a standard
         deck would cause you to bust if you drew one more card?"
         → Student enumerates ALL bust ranks (not just the highest)
         → Evaluated by code; LLM confirms or redirects with a hint

Part 2: "Each rank has 4 cards in a standard deck — so how many total
         cards out of 52 would cause a bust?"
         → Student multiplies (N bust ranks × 4)
         → Evaluated by code

Part 3: "How many of the remaining non-bust cards would actually improve
         your total?" (comparing improve% vs bust%)
         → Student reasons about the full distribution
         → LLM gives final synthesis connecting bust%, improve%,
           and the dealer's bust probability for this upcard
```

#### Wrong Stand on a Hard Hand (e.g., standing on hard 12 vs dealer 10)

A 3-part quiz that teaches the improving-card spectrum:

```
Part 1: "With a hard [total], how many different card ranks in a standard
         deck would improve your total without causing you to bust?"
         → Student enumerates ALL improving ranks (e.g., A + 2–9 for hard 12)

Part 2: "How many total cards out of 52 is that?"
         → Student multiplies (N improving ranks × 4 per rank)

Part 3: "The dealer busts only [X]% from a [rank] — given your [Y]%
         chance of improving, what does the math say you should do?"
         → Student reasons about hitting vs. standing given both numbers
         → LLM gives final synthesis
```

Every quiz question includes the dealer upcard and dealer bust probability in its framing. The connection between player risk and dealer bust chance is always explicit.

#### Wrong Hit on a Soft Hand (e.g., hitting soft 19)

Soft hand errors use a dedicated 1-question quiz (soft hands cannot bust):

```
Question: "You have a soft [total]. On a soft hand the Ace can count as 1
           if needed — so you cannot bust on one card. How many cards out
           of 52 would actually improve you to a total of 21?"
           → Student counts cards that complete exactly 21

Synthesis: LLM confirms, then explains: "Only [X]% of the deck improves
           you — you were already at [soft total], a strong hand. The
           dealer busts just [Y]% from a [rank], so standing is correct."
```

After any quiz completes (all parts answered), the "Continue" button appears in the sidebar. Clicking it resets the block count and starts a new hand.

### Quiz Answer Evaluation

All quiz answers are evaluated by code (`evaluateStep1`, `evaluateStep2`, `evaluateSoftStep1`). The LLM is never asked to parse or judge a numerical answer — it only confirms, redirects with a provided hint, or synthesizes the final explanation. This prevents LLM arithmetic errors.

### Block-Level Tutor Feedback

When 5 hands complete without a wrong first-action decision, `tutor-feedback` fires with a `blockDecisionLog` summary. The log contains every hand's:
- Starting hand and dealer upcard
- Every hit/stand decision made (total, soft/hard, action, correct/incorrect)
- Hand outcome (win/loss/push)

The LLM receives this full summary and is instructed to reference specific hands by number — e.g., "on hand 3 you correctly stood on 16 against a 6 because the dealer had a 42% bust chance."

### Tutor Sidebar

The tutor panel is always visible on the right side of the screen. It is never a fullscreen modal. This means:

- During forced tutor phases (`tutor-intro`, `tutor-feedback`, `bust-quiz`): the sidebar shows the tutor message and either an acknowledge button ("Got it") or a quiz chat input.
- During free play (`player-turn`, `round-over`): the sidebar shows a "Get Hint" button and a text input for the student to ask any probability question.

During `bust-quiz` phase: the game board remains visible but Hit/Stand are disabled. The student types quiz answers into the sidebar chat input. The "Continue" button replaces the text input only after the quiz reaches its final completed step.

### Win / Progression Condition

The player must make **5 consecutive correct first-action decisions** (correctness measured against Basic Strategy). Any incorrect first action resets `consecutiveCorrect` to 0. Subsequent decisions within the same hand (second hit, etc.) do not affect the streak but are tracked, logged, and reviewed by the tutor.

---

## State Shape (`Level1State`)

```ts
export interface HandDecision {
  action: "hit" | "stand";
  total: number;          // Player total at moment of decision
  soft: boolean;          // Was it a soft hand?
  correct: boolean;       // Was it the Basic Strategy correct action?
  dealerUpcard: string;   // Dealer rank at time of decision
}

export interface BlockHandSummary {
  handNumber: number;
  decisions: HandDecision[];
  outcome: "win" | "loss" | "push" | null;
  playerHandAtStart: string;  // Ranks of opening 2 cards
  dealerUpcard: string;
}

export interface Level1State {
  stage: 1 | 2 | 3 | 4 | 5;
  phase:
    | "tutor-intro"      // Tutor speaks; player must acknowledge before acting
    | "player-turn"      // Player chooses Hit or Stand
    | "dealer-turn"      // Dealer plays out automatically
    | "round-over"       // Outcome shown; stage 2 uses manual "Next Hand", 4–5 auto-advance
    | "tutor-feedback"   // Tutor evaluates decisions; player must acknowledge
    | "bust-quiz"        // Probability quiz interrupts after wrong first-action decision
    | "session-over";    // 5-in-a-row achieved; level complete

  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];       // [0] = upcard (visible); [1] = hole card (hidden until dealer-turn)

  // Decision tracking — ALL decisions per hand
  handDecisions: HandDecision[];          // Every hit/stand taken in the current hand
  decisionHandAtAction: Card[] | null;    // Player hand at moment of FIRST action (pre-draw snapshot)
  decisionDealerUpcard: Card | null;      // Dealer upcard at moment of first action

  // Session counters (only first action per hand affects these)
  correctDecisions: number;
  totalDecisions: number;
  consecutiveCorrect: number;             // Resets to 0 on incorrect first action
  lastDecisionCorrect: boolean | null;    // Result of first action in current hand
  sessionComplete: boolean;
  lastOutcome: "win" | "loss" | "push" | null;

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

  // Block summary for tutor-feedback after 5-hand blocks
  blockDecisionLog: BlockHandSummary[];

  // Wrong-decision quiz state (hard hands)
  lastWrongDecision: "hit" | "stand" | null;
  lastWrongDecisionTotal: number | null;
  lastWrongDecisionSoft: boolean | null;
  bustQuizData: BustQuizData | null;
  bustQuizStep: 1 | 2 | 3 | 4;          // 4 = quiz complete; Continue button shown
}
```

Soft hand quiz state (`SoftQuizState`) is managed in `Level1Session.tsx` component state (not in `Level1State`) since it does not affect game logic, only the tutor sidebar flow:

```ts
interface SoftQuizState {
  active: true;
  data: SoftHandQuizData;
  step: 1 | 2;   // 2 = synthesis delivered; Continue button shown
}
```

---

## Probability / Math Component

### Core Teaching Concept

There is one foundational probability in this level: **16/52 ≈ 31% of cards in a fresh deck are worth 10 points** (10, J, Q, K — four of each across four suits). Every other probability calculation flows from that number.

The level never adjusts probabilities based on cards dealt (no counting). This is intentional — the goal is to internalize the fresh-deck baseline before introducing shoe-composition effects in later levels.

### Required Calculations

#### `TEN_VALUE_PROBABILITY`

- **Value:** `16 / 52`
- **Note:** Exported as a named constant. Displayed as "31%" in the HUD throughout the entire level.

#### `getPlayerBustProbability(hand)`

- **Purpose:** "If I hit right now, what fraction of a fresh deck busts me?" Shown as "Bust If Hit" in the HUD.
- **Output:** `number` 0–1, or `null` if hand is empty
- **Algorithm:**
  ```
  If hand is empty: return null
  If hand is soft: return 0   (Ace absorbs any single card)
  If total <= 11:  return 0   (no single card can bust)
  If total > 21:   return 1   (already busted)
  Return PLAYER_BUST_PROB[total]:
    Hard 12 → 16/52  (~31%)   bust ranks: 10, J, Q, K
    Hard 13 → 20/52  (~38%)   bust ranks: 9–K
    Hard 14 → 24/52  (~46%)   bust ranks: 8–K
    Hard 15 → 28/52  (~54%)   bust ranks: 7–K
    Hard 16 → 32/52  (~62%)   bust ranks: 6–K
    Hard 17 → 36/52  (~69%)   bust ranks: 5–K
    Hard 18 → 40/52  (~77%)   bust ranks: 4–K
    Hard 19 → 44/52  (~85%)   bust ranks: 3–K
    Hard 20 → 48/52  (~92%)   bust ranks: 2–K (Ace as 1 = 21, not bust)
    Hard 21 → 52/52  (100%)   all cards bust
  ```
- **Teaching note:** The quiz explicitly asks students to enumerate these bust rank sets, not just recall the percentage. For hard 16, the answer is 8 bust ranks (6, 7, 8, 9, 10, J, Q, K) × 4 suits = 32 cards.

#### `getDealerBustProbability(upcard)`

- **Purpose:** "How often does the dealer bust playing from this upcard?" Shown as "Dealer Bust" in the HUD.
- **Algorithm:** Fixed lookup table (6-deck, dealer hits soft 17):
  ```
  "2" → 0.353,  "3" → 0.376,  "4" → 0.403,  "5" → 0.429,  "6" → 0.423,
  "7" → 0.262,  "8" → 0.244,  "9" → 0.230,
  "10", "J", "Q", "K" → 0.214,
  "A" → 0.117
  ```

#### `computeBustQuizData(playerAction, handTotal, isSoftHand, dealerUpcardRank)`

Returns a `BustQuizData` object with all values pre-computed for the quiz:

```ts
interface BustQuizData {
  playerAction: "hit" | "stand";
  handTotal: number;
  isSoftHand: boolean;
  dealerUpcardRank: string;
  dealerBustProbability: number;
  // For wrong hit: cards that bust
  bustCardRanks: string[];
  bustCardCount: number;
  bustProbability: number;
  // For all hands: ALL cards that improve without busting
  allImprovingRanks: string[];    // Deduplicated rank groups (e.g., "10/J/Q/K" counted once)
  allImprovingCount: number;      // Total cards that improve (proper 52-card count)
  improveProbability: number;
  // For wrong stand: highest reachable total (used in synthesis)
  bestImprovementCards: string[];
  bestImprovementTotal: number;
  bestImprovementCount: number;
  bestImprovementProbability: number;
}
```

All LLM quiz contexts receive pre-computed numbers from this object. The LLM is never asked to calculate probabilities itself.

#### `computeSoftHandQuizData(handTotal, dealerUpcardRank)`

Computes cards that reach 20 or 21 from a given soft total, for use in the soft-hand quiz path.

---

## Decision Snapshot

To prevent the LLM from seeing confusing post-bust state, the game snapshots the player's hand at the moment of the first action into `decisionHandAtAction`. `getLevel1GameContext()` always reports `Player hand at decision:` using this snapshot — never the final busted hand.

Example: Player has hard 15, hits correctly, draws a 10 → busts at 25. The tutor receives "Player hand at decision: 8, 7 (total: 15, hard)" not "total: 25."

---

## `getLevel1GameContext(state)` — LLM Context Format

```
Level 1 — Probability & Blackjack
Key probability: ~31% chance any card drawn is a 10-value (10, J, Q, K — 16 out of 52 cards)
Player hand at decision: 8, 7 (total: 15, hard)
Player bust probability if hitting from that total: 54%
Dealer upcard: 6 (dealer bust probability: 42%)
Phase: tutor-feedback
Last first-action decision: INCORRECT
All decisions this hand correct: no
Streak: 2 consecutive correct (need 5 to pass)
Session: 4/7 correct decisions

Decisions this hand:
  1. HIT on hard 15 vs dealer 6 — INCORRECT
  2. HIT on hard 19 vs dealer 6 — INCORRECT

Block summary (last 5 hands):          ← only present when phase is tutor-feedback
  Hand 1 (started: 10, 6 vs dealer 5, outcome: win):
    Decision 1: STAND on hard 16 vs dealer 5 — CORRECT
  Hand 2 (started: A, 7 vs dealer 10, outcome: loss):
    Natural blackjack — no decision needed.
  ...
```

---

## Tutor Prompts

### `feedback` prompt

```
Role: Patient blackjack probability tutor for a beginner.
Scope: Evaluating hit/stand decisions shown in "Decisions this hand" and "Block summary".
       Use the "Player hand at decision" field — NOT the final hand total — to describe
       what the player saw when they chose. Never comment on bust totals as if they
       were decisions.
Format: 3–4 sentences, plain text. Start with correct/incorrect verdict on the first
        action. Reference specific decisions by number if multiple were made. Cite
        bust probability, improve probability, and dealer bust probability. Close
        with one probability-based principle.
Constraint: No card counting, no running/true count, no Double Down, no Split,
            no bet sizing. No next-hand spoilers.
```

### `hint` prompt

```
Role: Blackjack probability tutor during active player decision.
Scope: Guide player toward the two key HUD numbers: their bust risk if they hit
       and the dealer's bust probability. If bust risk >= 50%, lead with that number.
       If dealer bust >= 35%, note the player can afford to be patient.
Format: 1–2 sentences, Socratic — ask a guiding question. Never state the correct action.
Constraint: No card counting, no running/true count, no Double Down, no Split,
            no bet sizing.
```

### `explanation` prompt

```
Role: Blackjack probability tutor for stage intros, student questions, and quiz tasks.
Scope: Always ground responses in probability — especially the 31% ten-value rate.
       When discussing bust ranks, enumerate ALL ranks that bust (not just the highest).
       When discussing improving cards, enumerate ALL ranks that improve (not just the best).
       Connect player probability to dealer bust probability explicitly.
Format: 2–4 sentences, plain text. For quiz tasks: ask first, wait for response, then
        confirm/correct and walk through the full calculation.
Constraint: No card counting, no running/true count, no Double Down, no Split,
            no bet sizing. Assume fresh 52-card deck; note denominator shrinks in practice.
```

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Player and dealer totals |
| `isSoft` | `@/game/cardUtils` | Detecting soft hands |
| `isBust` | `@/game/cardUtils` | Detecting bust after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Evaluating decision correctness |
| `initShoe` | `@/game/deckState` | Initializing 6-deck shoe |
| `dealCard` | `@/game/deckState` | Dealing cards |

`getProbabilities` from `@/game/deckState` is NOT used — Level 1 intentionally uses fresh-deck lookup tables to teach the baseline before shoe-state-aware math appears in later levels.

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
- [x] Allow the player to skip tutor interactions (intro, feedback, or quiz)
- [x] Ask the LLM to evaluate numerical answers — code evaluates all quiz answers

---

## Implementation Checklist

### `gameLogic.ts`
- [x] `HandDecision` and `BlockHandSummary` interfaces defined
- [x] `Level1State` uses `handDecisions: HandDecision[]` (replaces `firstActionDone` bool)
- [x] `decisionHandAtAction` and `decisionDealerUpcard` snapshot on first action
- [x] `blockDecisionLog: BlockHandSummary[]` accumulates across 5-hand blocks
- [x] `recordDecision()` appends to `handDecisions` for every hit/stand
- [x] Streak counters (`correctDecisions`, `totalDecisions`, `consecutiveCorrect`) only updated on first action per hand
- [x] `getLevel1GameContext()` uses `decisionHandAtAction` snapshot; never reports bust total as decision state
- [x] `getLevel1GameContext()` includes `Decisions this hand` log and `Block summary` when relevant
- [x] `appendBlockHandSummary()` exported for use in `advanceAfterRound`
- [x] All functions are pure — no DOM, no React imports, no side effects

### `quizLogic.ts`
- [x] `BustQuizData` includes `allImprovingRanks`, `allImprovingCount`, `improveProbability`
- [x] `computeBustQuizData()` computes full bust spectrum AND full improvement spectrum
- [x] `SoftHandQuizData` interface and `computeSoftHandQuizData()` implemented
- [x] `QuizStep` type covers `1 | 2 | 3 | 4` (step 4 = complete)
- [x] `evaluateStep1()` for wrong hit asks about bust rank count; for wrong stand asks about improving rank count
- [x] `evaluateStep2()` asks about total bust cards (hit) or total improving cards (stand)
- [x] `evaluateSoftStep1()` for soft hand hit asks about cards reaching 21
- [x] Dealer bust probability included in every quiz initial context and step 3 synthesis
- [x] LLM context builders (`getStage5Quiz*Context`, `getSoftHandQuiz*Context`) supply all numbers; LLM does no arithmetic

### `tutorPrompts.ts`
- [x] `feedback` prompt instructs LLM to use `Player hand at decision` field, not final total
- [x] `feedback` prompt instructs LLM to reference block summary by hand number
- [x] `hint` prompt leads with bust% when >= 50%; notes patient play when dealer bust >= 35%
- [x] `explanation` prompt instructs enumerating ALL bust/improving ranks, connecting both probabilities
- [x] All prompts exclude card counting, bet sizing, Double Down, Split

### `Level1Session.tsx`
- [x] `SoftQuizState` managed as component state (not in `Level1State`)
- [x] `advanceAfterRound()` checks for soft-hand wrong hit first, then hard wrong decision
- [x] Soft quiz triggers `setSoftQuiz({ active: true, data, step: 1 })` and sets `phase: "bust-quiz"`
- [x] `handleStudentMessage()` routes to soft quiz path or hard quiz path based on `softQuiz?.active`
- [x] Hard quiz handles steps 1, 2, 3 (advances step on correct answer); step 4 = complete
- [x] `showQuizContinue` = `bustQuizStep === 4` OR `(softQuiz?.active && softQuiz.step === 2)`
- [x] `handleAcknowledge()` clears `softQuiz` and resets block log on quiz continue
- [x] Decision badge reflects all decisions: "All N decisions correct" or "Incorrect decision (see tutor)"
- [x] Tutor sidebar visible at all times; never blocks game board
- [x] HUD shows P(Ten-Value) always; Bust If Hit + Dealer Bust during `player-turn`
- [x] Bust If Hit displayed in red when >= 50%, green when < 50%
- [x] Streak indicator visible in Stage 5
- [x] LLM errors display "Tutor unavailable. Try again." without crashing

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor sidebar appears on the right and never covers the game board
- [ ] Stage 1 tutor intro fires before first hand; "Let's Play" advances to free play
- [ ] P(Ten-Value) shows 31% throughout all stages and phases
- [ ] Bust If Hit updates correctly after each Hit action
- [ ] Dealer Bust shows correct percentage per upcard
- [ ] Tutor feedback references the actual bust probabilities, not generic advice
- [ ] Feedback in Stage 5 references the block summary with specific hand numbers
- [ ] Chat input accepts a question and returns a probability-focused response
- [ ] Streak resets on incorrect first-action decision
- [ ] Multi-hit hand: subsequent decisions tracked in log; tutor can reference them
- [ ] Wrong hit on hard hand triggers 3-part quiz; Part 3 synthesis mentions both bust% and dealer%
- [ ] Wrong stand on hard hand triggers 3-part quiz about improving cards + dealer probability
- [ ] Wrong hit on soft hand triggers soft-hand quiz asking about cards reaching 21
- [ ] Quiz Continue button appears only after final quiz step is answered correctly
- [ ] Session completes at exactly 5 consecutive correct first-action decisions
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
