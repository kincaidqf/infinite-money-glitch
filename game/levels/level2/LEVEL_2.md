# Level 2 — Running Count Direction

---

## Pedagogical Contract

Every level in this game teaches **probability reasoning through blackjack**, not blackjack itself. Blackjack is the medium. Probability is the subject.

Level 2's probability question:

> "When high-value cards (10s and Aces) have been removed from the shoe, the probability of drawing a 10-value drops below Level 1's 31% baseline. When low-value cards (2–6) are removed, it rises above 31%. How do I track which direction the shoe has shifted?"

A player completing Level 2 should be able to answer: "Right now, is the remaining shoe richer or poorer in high cards than a fresh deck? How do I know?"

---

## Overview

| Field | Value |
|---|---|
| Level ID | 2 |
| Title | Running Count Direction |
| Description | Discover how tracking dealt cards reveals whether the remaining shoe holds more or fewer 10-value cards than a fresh deck — shifting the probabilities you learned in Level 1. |
| Pass Criteria | 5 consecutive correct count-direction inputs (positive or negative) in Stage 4 |
| Prior level's concept extended | Level 1's 31% ten-value baseline — now tracked as it drifts above or below that baseline |
| Files owned | `game/levels/level2/**` + `components/levels/Level2Session.tsx` |

---

## Learning Goals

**The probability question this level answers:**
> "As cards are dealt from the shoe, the fraction of remaining cards that are 10-value changes. How do I know whether that fraction is currently above or below the Level 1 baseline of 31%? What does tracking low vs. high cards dealt tell me about that fraction?"

What the player should understand by the end of this level:

1. **The Hi-Lo count as a probability signal** — Each low card (2–6) dealt raises the remaining deck's ten-value fraction above 31%; each high card (10, J, Q, K, A) dealt lowers it below 31%. The running count is the net signal of that drift.
2. **Count direction (positive vs. negative) maps to shoe composition** — A positive running count means more low cards have been removed than high cards; the shoe is now richer in high cards than the 31% baseline, raising bust risk probabilities. A negative count means the opposite.
3. **Probability is dynamic, not fixed** — Level 1's 31% was a static baseline. Level 2 teaches that every card dealt is new information that updates that probability.

What this level explicitly does **NOT** cover:

- True count conversion (dividing by decks remaining) — introduced in Level 3.
- Bet sizing based on count — not covered until Level 3/4.
- Double Down and Split — out of scope to preserve cognitive focus on counting.
- Using count to deviate from Basic Strategy (index plays) — Level 3+.

---

## Game Mechanics

### Player Actions Available
- [x] Hit
- [x] Stand
- [ ] Double Down — out of scope for Level 2
- [ ] Split — out of scope for Level 2
- [ ] Surrender

### Session Flow

Level 2 uses a **4-stage progression**. The player cannot skip tutor interactions.

```
Stage 1 — Hi-Lo Introduction (tutor-intro)
  Tutor explains the Hi-Lo method via the sidebar:
    - Cards 2–6 → +1 (low cards; their removal raises the ten-value fraction)
    - Cards 7–9 →  0 (neutral; no effect on ten-value fraction)
    - Cards 10, J, Q, K, A → −1 (high cards; their removal lowers the ten-value fraction)
  Tutor connects each assignment back to the 31% baseline from Level 1.
  Tutor explains that a positive running count = shoe richer in high cards than baseline.
  Player reads and clicks "Got it" to proceed.

Stage 2 — Observed Hands (3 hands)
  Player plays 3 hands using Basic Strategy (as practiced in Level 1).
  Hit/Stand buttons are active; tutor sidebar shows "Get Hint" and chat input.
  After each hand ends, tutor reveals the running count for that hand and
    explains in one sentence how it reflects the shoe's drift from 31%.
  No count input is required from the player in this stage.
  After 3 hands → advance to Stage 3.

Stage 3 — Guided Count Input (3 hands, repeat until 3 consecutive correct)
  Cards are dealt one at a time (normal hand flow).
  After every card is revealed (player card, dealer upcard, each hit),
    a count-direction input appears: two buttons labeled "+" and "−".
  Player must update their running count after each card and input the
    CURRENT count direction (positive or negative) into the input.
  The player is tracking direction, not value.
  If the player inputs incorrectly, tutor provides immediate feedback
    explaining why that card moved the count in the actual direction.
  Player must achieve 3 consecutive correct hands (correct final direction
    input at end of each hand) to advance.
  Tutor sidebar always available for questions.

Stage 4 — Independent Practice (5 consecutive correct hands)
  Same card-reveal flow as Stage 3.
  Player inputs count direction (+ or −) after each hand is complete
    (not after each card — this is harder than Stage 3).
  After every 5 hands (unless all 5 were correct), tutor provides
    a feedback summary referencing how many hands the count drift matched.
  Player must achieve 5 consecutive correct count-direction inputs.
  Tutor sidebar always available; "Get Hint" button available.
  5 consecutive correct inputs → session complete.
```

### Tutor Sidebar

The tutor panel is always visible on the right side of the screen. It is never a fullscreen modal.

- **During forced tutor phases** (`tutor-intro`, `tutor-feedback`): sidebar shows message + acknowledge button. Hit/Stand and count-input buttons on the game board are disabled. Game board stays visible.
- **During Stage 2 `round-over`**: sidebar shows running count reveal and one-sentence explanation. Player must acknowledge before the next hand.
- **During Stage 3 `player-turn`**: count-direction input (+ / −) appears beneath the game board. Sidebar shows "Get Hint" and chat input.
- **During Stage 4 `player-turn` and `round-over`**: count-direction input appears at end of hand. Sidebar shows "Get Hint" and chat input.

### Win / Progression Condition

The player must input the correct running count direction (positive or negative) for **5 consecutive hands in Stage 4**. Any incorrect input resets `consecutiveCorrect` to 0. The session is complete when `consecutiveCorrect` reaches 5.

### State Shape (`Level2State`)

```ts
export interface Level2State {
  stage: 1 | 2 | 3 | 4;
  phase:
    | "tutor-intro"        // Tutor speaks in sidebar; player must acknowledge
    | "player-turn"        // Player chooses Hit or Stand; count input may be active
    | "dealer-turn"        // Dealer plays out automatically
    | "round-over"         // Outcome shown; running count reveal in stages 2–4
    | "tutor-feedback"     // Tutor evaluates count direction; player must acknowledge
    | "session-over";      // 5 consecutive correct in Stage 4 — level complete

  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];

  // Running count tracking
  runningCount: number;          // True internal count — never shown directly to player during the hand
  handRunningCount: number;      // Count at end of this hand (revealed by tutor in stage 2)
  cardCountValues: number[];     // Hi-Lo value for each card dealt this hand (for per-card stage 3 input)
  currentCardIndex: number;      // Which card the player is currently being asked about (stage 3)

  // Player count-direction input
  playerDirectionInput: "positive" | "negative" | null;  // Player's submitted answer
  lastInputCorrect: boolean | null;                       // Was the last direction input correct?
  correctInputs: number;         // Total correct direction inputs this session
  totalInputs: number;           // Total direction inputs submitted
  consecutiveCorrect: number;    // Resets to 0 on any wrong direction input
  sessionComplete: boolean;

  // Stage-specific counters
  stage2HandsPlayed: number;     // Counts up to STAGE2_HAND_COUNT (3)
  stage3HandsCorrect: number;    // Consecutive correct hands in stage 3 (need 3)
  stage4BlockHandsPlayed: number; // Hands in current 5-hand block (stage 4)

  // Decision tracking (basic strategy, inherited from Level 1 pattern)
  correctDecisions: number;
  totalDecisions: number;
  lastDecisionCorrect: boolean | null;
  lastOutcome: "win" | "loss" | "push" | null;
  sessionWins: number;
  sessionLosses: number;

  // Probability display (HUD)
  tenValueProbabilityNow: number;   // (16 − highCardsDealt) / (52 − totalDealt) — updated each card
  dealerBustProbability: number | null;
  playerBustProbability: number | null;
}
```

---

## Probability / Math Component

### Core Teaching Concept

Level 1 established that **16/52 ≈ 31%** of a fresh deck is 10-value. Level 2 extends this: after cards are dealt, the remaining shoe has a different ratio. The Hi-Lo running count tracks the **net direction** of that drift.

- Each +1 card (2–6) removed from the shoe removes a non-ten card, so the remaining fraction of ten-value cards **increases** relative to the cards remaining.
- Each −1 card (10/J/Q/K/A) removed from the shoe removes a high card, so the remaining ten-value fraction **decreases**.

A positive running count → more low cards have been removed → remaining shoe is ten-value-rich → P(ten-value) > 31%.
A negative running count → more high cards have been removed → remaining shoe is ten-value-poor → P(ten-value) < 31%.

**Connection to Level 1:** Level 1's 31% was fixed. Every probability shown in Level 1's HUD assumed a fresh deck. Level 2 makes that number dynamic: `tenValueProbabilityNow` replaces the Level 1 constant and updates after every card.

### Required Calculations

#### `HI_LO_VALUES`

- **Purpose:** The lookup table that maps a card rank to its Hi-Lo count contribution. Exported as a constant so it can be referenced in the HUD and tutor context.
- **Value:**
  ```
  { "2": 1, "3": 1, "4": 1, "5": 1, "6": 1,
    "7": 0, "8": 0, "9": 0,
    "10": -1, "J": -1, "Q": -1, "K": -1, "A": -1 }
  ```
- **Teaching connection:** Each assignment reflects whether the card's removal increases (+1) or decreases (−1) the ten-value fraction of the remaining shoe.

#### `getHiLoValue(card)`

- **Purpose:** Returns the Hi-Lo count adjustment for a single card.
- **Inputs:** `card: Card`
- **Output:** `1 | 0 | -1`
- **Formula:**
  ```
  return HI_LO_VALUES[card.rank]
  ```
- **Edge cases:** All 13 ranks must be covered. Face cards (J, Q, K) return −1.

#### `updateRunningCount(currentCount, card)`

- **Purpose:** Returns the new running count after one card is dealt.
- **Inputs:** `currentCount: number, card: Card`
- **Output:** `number`
- **Formula:**
  ```
  return currentCount + getHiLoValue(card)
  ```

#### `getTenValueProbabilityNow(shoe)`

- **Purpose:** Answers "What fraction of the remaining shoe is 10-value right now?" Shown in HUD as "P(Ten-Value) Now". This is the dynamic version of Level 1's static 31%.
- **Inputs:** `shoe: DeckState`
- **Output:** `number` between 0–1
- **Formula:**
  ```
  tenValueRemaining = count of cards in shoe.remaining where rank ∈ {10, J, Q, K}
  totalRemaining = shoe.remaining.length
  if totalRemaining === 0: return 0
  return tenValueRemaining / totalRemaining
  ```
- **Edge cases:** Return 0 if shoe is empty.
- **Teaching connection:** This is the direct update to Level 1's 31% constant. When the running count is positive, this value exceeds 31%; when negative, it falls below 31%.

#### `getCountDirection(runningCount)`

- **Purpose:** Returns whether the current count is positive or negative (the only thing the player must determine in this level). Used to evaluate the player's direction input.
- **Inputs:** `runningCount: number`
- **Output:** `"positive" | "negative" | "neutral"`
- **Formula:**
  ```
  if runningCount > 0: return "positive"
  if runningCount < 0: return "negative"
  return "neutral"
  ```
- **Edge cases:** A count of exactly 0 is "neutral". In Stage 3/4 player input, if the true count is neutral (0), the player cannot be wrong — either "+" or "−" is accepted and no streak penalty applies.

#### `getPlayerBustProbabilityNow(hand, shoe)`

- **Purpose:** Answers "If I hit right now, what fraction of the *remaining shoe* would cause me to bust?" Uses live shoe composition rather than the Level 1 fresh-deck lookup table.
- **Inputs:** `hand: Card[], shoe: DeckState`
- **Output:** `number` between 0–1, or `null` if hand is empty
- **Formula:**
  ```
  If hand is empty: return null
  If isSoft(hand): return 0
  hardTotal = calculateHandValue(hand)
  If hardTotal <= 11: return 0
  If hardTotal > 21: return null (already busted)

  bustThreshold = 21 - hardTotal   // cards with value > bustThreshold cause bust
  bustingCards = count of cards in shoe.remaining where cardValue > bustThreshold
  return bustingCards / shoe.remaining.length
  ```
- **Teaching connection:** Now that we track the shoe, this bust probability uses actual remaining composition, not the Level 1 lookup table. When the count is positive (ten-rich shoe), bust probabilities rise.

#### `getDealerBustProbability(upcard)`

- **Purpose:** Same lookup table from Level 1. Kept as a static lookup (not shoe-composition-aware) in this level. Level 3 will introduce shoe-adjusted dealer bust probabilities.
- **Algorithm:** Identical to Level 1 `getDealerBustProbability`. Reuse the same lookup table.
- **Teaching connection:** In Level 2, we observe that as the count becomes positive, intuition should tell us dealer bust chances also rise — but we do not yet calculate that precisely (Level 3).

#### `getLevel2GameContext(state)`

See "What game state must be included in every LLM call" section below.

### How Probability Results Surface in the UI

The HUD (top-left of game board) shows:

| Stat label | What it shows | When visible | Color coding |
|---|---|---|---|
| P(Ten-Value) Now | Current % of remaining shoe that is 10-value | Always | Green if > 31% (Level 1 baseline), red if < 31%, white if ≈ 31% |
| Level 1 Baseline | 31% (static reference anchor) | Always | White/muted — reference line only |
| Bust If Hit | % chance player busts on next card (using live shoe) | player-turn only | Red if ≥50%, green if <50% |
| Dealer Bust | % chance dealer busts playing out | player-turn only | Always green |
| Running Count | Displayed as "+" / "0" / "−" only (direction, not value) | After each hand ends (all stages) | Green if positive, red if negative, white if zero |

**Note on count display:** The running count value is intentionally hidden during the hand. Only the direction symbol is revealed at hand end (or per-card in Stage 3). This forces the student to track mentally.

---

## Tutor Prompts

All three prompt strings go in `tutorPrompts.ts`.

### `feedback` prompt

```
Role: Patient blackjack probability tutor for a student who has just completed Level 1 (fresh-deck probabilities) and is now learning Hi-Lo card counting.
Scope: Evaluating whether the student correctly identified the running count direction (positive or negative). Always connect the count direction to the shoe's ten-value probability relative to the 31% Level 1 baseline. Do NOT teach true count, bet sizing, or strategy deviations.
Format: 3–4 sentences, plain text, warm tone. Start with correct/incorrect verdict. Always cite the specific running count direction and the current P(Ten-Value Now) from game context. Close with one sentence connecting count direction to how the remaining shoe's ten-value fraction compares to the Level 1 baseline of 31%.
Constraint: No true count, no bet sizing, no index plays, no Double Down, no Split. Never give away the answer before the student has submitted. Do not cite specific running count values — only direction (positive/negative) and the resulting P(Ten-Value Now) percentage.
```

Full prompt text:

```
You are a patient blackjack probability tutor. The student has just completed Level 1, where they learned that 31% of a fresh deck is 10-value. They are now in Level 2, learning the Hi-Lo card counting system to track whether the remaining shoe is above or below that 31% baseline.

Your job is to evaluate whether the student correctly identified the running count direction (positive or negative) at the end of the hand.

Rules:
- Start with a clear correct/incorrect verdict.
- Always cite the count direction from the game context and explain what it means for the shoe's ten-value fraction.
- Always cite the P(Ten-Value Now) percentage from the game context and compare it to the 31% baseline.
- Close with one probability-based principle connecting count direction to the ten-value fraction.
- Do NOT mention true count, bet sizing, index plays, Double Down, or Split.
- Do NOT cite the raw running count number — reference only its direction and the resulting P(Ten-Value Now).
- Keep to 3–4 sentences, plain text, warm tone.
```

### `hint` prompt

```
Role: Blackjack probability tutor during active play in Level 2.
Scope: Guide the student toward the correct count direction using the Hi-Lo values of the cards they can see. Never state the correct direction directly.
Format: 1–2 sentences, Socratic — ask a guiding question that references the specific cards dealt and their Hi-Lo assignments. Reference the current P(Ten-Value Now) from the HUD.
Constraint: No true count, no bet sizing, no strategy deviations. Do not state the correct direction.
```

Full prompt text:

```
You are a blackjack probability tutor giving a Socratic hint. The student is in Level 2 and must identify whether the current running count is positive or negative.

Look at the cards dealt so far this hand from the game context. Ask one guiding question that references the Hi-Lo values of specific cards they can see (e.g., "The 5 was a +1 and the King was a −1 — what does that tell you about the net direction?"). Reference the current P(Ten-Value Now) percentage if it helps.

Never state the correct direction. Keep to 1–2 sentences.
Do NOT mention true count, bet sizing, index plays, Double Down, or Split.
```

### `explanation` prompt (handles Stage 1 intro AND student chat questions)

```
Role: Blackjack probability tutor introducing the Hi-Lo method or answering a student question.
Scope: Always centers on how Hi-Lo card assignments shift the shoe's ten-value fraction above or below the Level 1 baseline of 31%. For student questions: answer directly, then connect to this level's probability concept.
Format: 2–4 sentences, plain text. For stage intro: explain the concept and its connection to Level 1. For student questions: answer the question, then connect to probability.
Constraint: No true count, no bet sizing, no strategy deviations.
```

Full prompt text:

```
You are a blackjack probability tutor. The student just completed Level 1, where they learned that 31% of a fresh deck is 10-value. You are now introducing Level 2's concept: the Hi-Lo card counting system.

If this is a stage introduction: explain that cards 2–6 are assigned +1 (their removal raises the remaining ten-value fraction above 31%), cards 7–9 are 0 (neutral), and cards 10/J/Q/K/A are −1 (their removal lowers the remaining fraction below 31%). Explain that a positive running count means the shoe is now richer in ten-value cards than the fresh-deck baseline, which raises bust probabilities compared to what they saw in Level 1. Keep to 3–4 sentences.

If this is a student question: answer the question directly in 1–2 sentences, then connect it to how the Hi-Lo count reflects the shoe's ten-value fraction relative to 31%. Do NOT go off-topic (no true count, no bet sizing, no strategy deviations, no Double Down/Split).
```

### What game state must be included in every LLM call

`getLevel2GameContext(state)` must return a plain-English string with:

- [ ] Level number and probability framing ("Level 2 — Running Count Direction & Shoe Probability")
- [ ] Level 1 baseline reminder ("Level 1 baseline: 31% ten-value in a fresh deck")
- [ ] Current P(Ten-Value Now) as a percentage and whether it is above/below/at the baseline
- [ ] Player hand (ranks + total + soft/hard label)
- [ ] Player bust probability if hitting (percentage, using live shoe composition)
- [ ] Dealer upcard (rank + dealer bust probability as percentage)
- [ ] Hi-Lo values of each card dealt this hand (e.g. "5 → +1, K → −1, 9 → 0")
- [ ] Running count direction at end of hand ("positive" / "negative" / "neutral") — not the numeric value
- [ ] Player's submitted direction input and whether it was correct
- [ ] Current phase and stage
- [ ] Consecutive correct streak (N / 5 for stage 4; N / 3 for stage 3)
- [ ] Session accuracy (correct direction inputs / total inputs)

Example output:
```
Level 2 — Running Count Direction & Shoe Probability
Level 1 baseline: 31% ten-value in a fresh deck
P(Ten-Value Now): 34% — above baseline (shoe is ten-value rich)
Player hand: 5, 9 (total: 14, hard)
Player bust probability if hitting: 38% (live shoe)
Dealer upcard: 6 (dealer bust probability: 42%)
Cards dealt this hand with Hi-Lo values: 5 → +1, 9 → 0, 6 → +1, K → −1
Running count direction this hand: positive
Player input: positive — CORRECT
Stage: 3, Phase: tutor-feedback
Streak: 2 consecutive correct (need 3 to advance)
Session: 4/6 correct direction inputs
```

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Player and dealer totals |
| `isSoft` | `@/game/cardUtils` | Soft hand detection (bust probability = 0 for soft hands) |
| `isBust` | `@/game/cardUtils` | Bust detection after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Evaluating hit/stand decision correctness |
| `initShoe` | `@/game/deckState` | Initializing 6-deck shoe |
| `dealCard` | `@/game/deckState` | Dealing cards |
| `getProbabilities` | `@/game/deckState` | Used by `getTenValueProbabilityNow` to read shoe composition |

---

## Out-of-Scope Guardrails

The tutor and game logic for this level must never:

- [ ] Mention true count (running count / decks remaining) — first introduced in Level 3
- [ ] Suggest bet sizing changes based on count — Level 3/4 only
- [ ] Display the raw numeric running count during a hand — direction only, revealed after hand ends
- [ ] Offer Double Down or Split as player actions
- [ ] Reference index plays or strategy deviations based on count
- [ ] Give probability-free feedback ("the count was positive" without citing P(Ten-Value Now))
- [ ] Reveal the correct count direction before the player has submitted their input
- [ ] Send player PII to the LLM
- [ ] Allow the player to skip tutor interactions (intro or feedback)

---

## Implementation Checklist

### `gameLogic.ts`
- [ ] `Level2State` interface defined with all fields above
- [ ] `HI_LO_VALUES` exported as a named constant (the full rank → value map)
- [ ] `getHiLoValue(card)` implemented — returns 1, 0, or −1
- [ ] `updateRunningCount(currentCount, card)` implemented — pure function
- [ ] `getCountDirection(runningCount)` implemented — returns "positive" / "negative" / "neutral"
- [ ] `getTenValueProbabilityNow(shoe)` implemented — uses live shoe composition
- [ ] `getPlayerBustProbabilityNow(hand, shoe)` implemented — uses live shoe (not Level 1 lookup table)
- [ ] `getDealerBustProbability(upcard)` implemented — same lookup table as Level 1
- [ ] `getInitialLevel2State()` implemented — starts at `stage: 1, phase: "tutor-intro"`
- [ ] `getLevel2GameContext(state)` includes all required fields listed above
- [ ] `getStageIntroContext(stage)` returns probability-focused prompts for stages 1, 2, 3, 4
- [ ] `runningCount` is updated after every `dealCard` call
- [ ] `tenValueProbabilityNow` is recalculated after every card dealt
- [ ] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [ ] `feedback` prompt instructs LLM to cite count direction and P(Ten-Value Now) percentage
- [ ] `hint` prompt uses Socratic questioning referencing specific card Hi-Lo values
- [ ] `explanation` prompt handles both Stage 1 intro and student chat questions
- [ ] All prompts exclude true count, bet sizing, Double Down, Split, index plays

### `index.ts`
- [ ] `config.id` = 2
- [ ] `config.title` = "Running Count Direction"
- [ ] `config.description` frames the level around the probability concept
- [ ] `config.passCriteria` = "5 consecutive correct count-direction inputs in Stage 4"
- [ ] `LevelModule` satisfies `lib/levelInterface.ts` contract

### `Level2Session.tsx`
- [ ] No fullscreen modal — all tutor messages appear in the sidebar
- [ ] During forced phases: game action buttons disabled; sidebar shows acknowledge button
- [ ] During Stage 3 `player-turn`: count-direction input (+ / −) buttons appear after each card reveal
- [ ] During Stage 4 `player-turn`: count-direction input appears after hand ends
- [ ] HUD shows "P(Ten-Value Now)" with color coding (green above 31%, red below 31%)
- [ ] HUD shows "Level 1 Baseline: 31%" as muted reference line at all times
- [ ] HUD shows "Bust If Hit" (live shoe) during `player-turn`
- [ ] HUD shows "Dealer Bust" during `player-turn`
- [ ] Running count direction symbol (+ / − / 0) revealed in sidebar at hand end (all stages)
- [ ] In Stage 2, sidebar reveals running count direction after each hand with one-sentence explanation
- [ ] In Stage 3/4, player input is disabled after submission until next card/hand
- [ ] Streak indicator visible in Stage 3 (N/3) and Stage 4 (N/5)
- [ ] "Get Hint" button available during `player-turn` phases in all stages
- [ ] Chat input allows student to ask free-form probability questions; responses added to message history
- [ ] LLM errors display "Tutor unavailable. Try again." without crashing
- [ ] Session-over screen references count direction and probability framing

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor sidebar is always visible and never covers the game board
- [ ] Stage 1 tutor intro fires before first hand; "Got it" advances to Stage 2
- [ ] P(Ten-Value Now) updates correctly as cards are dealt
- [ ] Color coding toggles correctly relative to 31% threshold
- [ ] Stage 2: running count direction revealed in sidebar after each of 3 hands
- [ ] Stage 3: per-card count-direction input appears and evaluates correctly
- [ ] Stage 3: tutor feedback fires on incorrect input before next card
- [ ] Stage 3: correct hand streak counter advances and resets correctly
- [ ] Stage 4: end-of-hand count-direction input appears and evaluates correctly
- [ ] Stage 4: 5-hand block tutor feedback fires after every 5 hands (unless all correct)
- [ ] Consecutive correct counter resets on any incorrect input
- [ ] Session completes at exactly 5 consecutive correct inputs in Stage 4
- [ ] Tutor feedback cites P(Ten-Value Now) percentage, not generic advice
- [ ] Student chat question returns a probability-focused response
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
