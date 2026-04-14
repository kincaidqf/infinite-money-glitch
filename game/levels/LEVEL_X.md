# Level X — [Level Title]

> **Template instructions:** Replace every `[PLACEHOLDER]` with level-specific content before implementation begins. Delete this callout block when done.

---

## Pedagogical Contract

> **Read this before filling in any other section.**

Every level in this game teaches **probability reasoning through blackjack**, not blackjack itself. Blackjack is the medium. Probability is the subject.

A player completing any level should be able to answer a probability question — not just describe a rule. Before writing your learning goals, write the probability question your level answers. If you can't articulate it as a probability question, the scope is wrong.

**What this means in practice:**

- Learning goals must start with a probability concept, not a blackjack mechanic. "Understand how removing known cards shifts bust probability" is a learning goal. "Learn to count cards" is not.
- The tutor's feedback must always cite a specific number. "You should have stood" is insufficient. "You should have stood — with a 62% chance of busting if you hit and the dealer holding only a 14% bust chance, the math favors standing" is the standard.
- The HUD must display at least one live probability stat during every hand. Players should always have a number to reason about.
- Tutor prompts must include an explicit instruction to cite probabilities from the game context. The LLM defaults to generic advice if not constrained.
- The sidebar tutor panel (established in Level 1) should remain the interaction pattern for all levels. Students should be able to ask free-form probability questions at any time during practice phases.

**The probability thread across levels (for context):**

| Level | Core Probability Question |
|-------|--------------------------|
| 1 | What is the probability any card is a 10-value, and how does that explain bust risk? |
| 2 | How does removing known cards from the shoe shift the probability of drawing a 10-value? |
| 3 | How does a changed 10-value probability affect the expected value of hitting vs. standing? |
| 4 | How does the true count translate into a precise edge percentage, and when does that edge justify changing bet size? |

Each level builds on the prior level's probability concept. Level X should make explicit what probability tool from the previous level it is extending.

---

## Overview

| Field | Value |
|---|---|
| Level ID | X |
| Title | [e.g. "Running Count"] |
| Description | [1-sentence player-facing description — frame it around the probability concept, not the mechanic] |
| Pass Criteria | [e.g. "≥70% correct decisions across a full simulated shoe"] |
| Prior level's concept extended | [e.g. "Level 1's 31% ten-value baseline — now adjusted by shoe composition"] |
| Files owned | `game/levels/levelX/**` + `components/levels/LevelXSession.tsx` |

---

## Learning Goals

**The probability question this level answers:**
> [Write the question in plain English. E.g. "If I know 8 ten-value cards have already been dealt from a 52-card shoe, what is the new probability that the next card is a 10-value, and how does that change my decision?"]

What the player should understand by the end of this level:

1. **[Primary probability concept]** — [Describe as a probability statement, not a rule. E.g. "Removing cards from the shoe changes the fraction of remaining cards that are ten-value, which directly shifts bust probabilities for both the player and dealer."]
2. **[Secondary concept]** — [What follows from the primary concept in this level's context]
3. **[Optional tertiary concept]**

What this level explicitly does NOT cover (maintain scope boundaries):

- [e.g. "True count conversion — first introduced in Level 3"]
- [e.g. "Bet sizing — not covered until Level 3"]

---

## Game Mechanics

### Player Actions Available
- [ ] Hit
- [ ] Stand
- [ ] Double Down
- [ ] Split
- [ ] Surrender

### Tutor Sidebar

The tutor panel must be always visible on the right side of the screen, matching the pattern established in Level 1. Never use a fullscreen modal.

- **During forced tutor phases** (`tutor-intro`, `tutor-feedback`): sidebar shows message + acknowledge button; game action buttons are disabled. Game board stays visible.
- **During practice phases** (`player-turn`, `round-over`): sidebar shows "Get Hint" button + a chat input for free-form student probability questions. All responses add to a scrolling message history.

### Win / Progression Condition

[Describe exactly what metric(s) determine a pass. State it as a probability or accuracy threshold.]

### State Shape (`LevelXState`)

```ts
export interface LevelXState {
  stage: [list valid stage numbers];
  phase:
    | "tutor-intro"
    | "player-turn"
    | "dealer-turn"
    | "round-over"
    | "tutor-feedback"
    | "session-over";

  shoe: DeckState;
  playerHand: Card[];
  dealerHand: Card[];

  // Decision tracking
  correctDecisions: number;
  totalDecisions: number;
  consecutiveCorrect: number;
  lastDecisionCorrect: boolean | null;
  sessionComplete: boolean;
  lastOutcome: "win" | "loss" | "push" | null;
  firstActionDone: boolean;
  sessionWins: number;
  sessionLosses: number;

  // Probability display (always include at least these two)
  dealerBustProbability: number | null;
  playerBustProbability: number | null;

  // Level X additions — justify each field
  // [fieldName]: [type]; // Why: [how this enables the level's probability concept]
}
```

---

## Probability / Math Component

### Core Teaching Concept

[Describe in plain English what probability concept the player is learning. Connect it explicitly to Level 1's 31% baseline and describe how this level extends it.]

**Connection to Level 1:** [E.g. "Level 1 established that 16/52 ≈ 31% of a fresh deck is 10-value. Level 2 extends this: after N ten-value cards are dealt, the new probability is (16−N) / (52−totalDealt). This level teaches the player to track and apply that updated probability."]

### Required Calculations

List every calculation in `gameLogic.ts`. For each one:

#### `[FunctionName]`

- **Purpose:** [What probability question this answers for the player]
- **Inputs:** [Parameters with types]
- **Output:** [Return type — must be a `number` between 0–1 or `null`, not a string]
- **Formula / Algorithm:**
  ```
  [Write the math or pseudocode. Be precise. An implementer must have zero ambiguity.]
  ```
- **Edge cases:** [Any inputs needing special handling]
- **Teaching connection:** [One sentence explaining how this number connects to the level's probability concept]

### How Probability Results Surface in the UI

The HUD (top-left corner of the game board) must display at minimum:

1. **A persistent anchor stat** — one probability that is constant or slowly changing, which the player should internalize. (In Level 1 this was P(Ten-Value) = 31%.)
2. **A live decision stat** — one probability that changes with each hit or new hand, directly informing the current decision.

Describe each stat:

| Stat label | What it shows | When visible | Color coding |
|---|---|---|---|
| [e.g. "P(Ten-Value)"] | [e.g. Current % of remaining deck that is 10-value] | [e.g. Always] | [e.g. Green if higher than Level 1 baseline, red if lower] |
| [e.g. "Bust If Hit"] | [e.g. % chance player busts on next card] | [e.g. player-turn only] | [e.g. Red if ≥50%, green if <50%] |
| [e.g. "Dealer Bust"] | [e.g. % chance dealer busts playing out] | [e.g. player-turn only] | [e.g. Always green — favorable to player] |

The tutor's feedback must always reference the values displayed in the HUD. The LLM context string from `getGameContext()` must include these values so the tutor can cite them.

---

## Tutor Prompts

All three prompt strings go in `tutorPrompts.ts`. Follow the four-part structure: **Role / Scope / Format / Constraint**.

**Standing rule for all levels:** Every tutor prompt must include an explicit instruction to cite specific probability numbers from the game context. Without this constraint, the LLM defaults to generic advice.

### `feedback` prompt

```
Role: [What the tutor is in this level's context]
Scope: [What probability concept this level covers — be explicit about exclusions]
Format: 3–4 sentences, plain text. Start with correct/incorrect verdict.
        Always cite the specific probability numbers from the game context.
        Close with one probability-based principle.
Constraint: [What the tutor must NOT do — include no card counting / no bet sizing
            if they are out of scope for this level]
```

Full prompt text:

```
[Paste the complete system prompt string here. It must instruct the LLM to
cite probabilities from the game context, not give generic blackjack advice.]
```

### `hint` prompt

```
Role: [Tutor giving a Socratic hint]
Scope: [Level's probability concept]
Format: 1–2 sentences. Ask a guiding question using specific probability numbers
        from the HUD. Do not state the correct action.
Constraint: [Exclusions]
```

Full prompt text:

```
[Paste the complete system prompt string here.]
```

### `explanation` prompt (handles stage intros AND student chat questions)

```
Role: [Tutor explaining a concept or answering a student question]
Scope: [Level's probability concept — always connect to prior levels' baseline]
Format: 2–4 sentences, plain text. For student questions: answer directly,
        then connect to the level's probability concept.
Constraint: [Exclusions]
```

Full prompt text:

```
[Paste the complete system prompt string here.]
```

### What game state must be included in every LLM call

`getLevelXGameContext(state)` must return a plain-English string with:

- [ ] Level number and probability framing (e.g. "Level 2 — Running Count & Shoe Probability")
- [ ] The level's anchor probability (e.g. current P(ten-value) in remaining shoe)
- [ ] Player hand (ranks + total + soft/hard label)
- [ ] Player bust probability if hitting (percentage)
- [ ] Dealer upcard (rank + dealer bust probability)
- [ ] Current phase
- [ ] Last decision result (CORRECT / INCORRECT / none yet)
- [ ] Streak and session accuracy
- [ ] [Any level-specific context fields]

---

## Shared Utilities

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | Player and dealer totals |
| `isSoft` | `@/game/cardUtils` | Soft hand detection (affects bust probability) |
| `isBust` | `@/game/cardUtils` | Bust detection after hit |
| `getBasicStrategyAction` | `@/game/basicStrategy` | Evaluating decision correctness |
| `initShoe` | `@/game/deckState` | Initializing the shoe |
| `dealCard` | `@/game/deckState` | Dealing cards |
| `getProbabilities` | `@/game/deckState` | [Include if this level uses shoe-state-aware probabilities] |

Remove rows for utilities not used by this level.

---

## Out-of-Scope Guardrails

The tutor and game logic for this level must never:

- [ ] Mention concepts reserved for later levels (specify which)
- [ ] Give probability-free feedback ("you should have stood" without citing a number)
- [ ] Display a probability stat without connecting it to the level's teaching concept
- [ ] Reveal the correct action before the player has decided (hints must be Socratic)
- [ ] Send player PII to the LLM
- [ ] Allow the player to skip tutor interactions (intro or feedback)

---

## Implementation Checklist

### `gameLogic.ts`
- [ ] `LevelXState` interface defined
- [ ] A named constant for the level's anchor probability exported (like `TEN_VALUE_PROBABILITY` in Level 1)
- [ ] `getInitialLevelXState()` implemented — starts at `phase: "tutor-intro"`
- [ ] `getLevelXGameContext(state)` includes anchor probability, both bust probabilities, and level-specific fields
- [ ] All required probability functions implemented (see Math Component section)
- [ ] `getStageIntroContext(stage)` returns probability-focused prompts — not rule-based explanations
- [ ] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [ ] `feedback` prompt instructs LLM to cite specific probability numbers
- [ ] `hint` prompt uses Socratic questioning with HUD values
- [ ] `explanation` prompt handles both stage intros and student chat questions
- [ ] All prompts exclude out-of-scope concepts

### `index.ts`
- [ ] `config.title` reflects probability framing (not just a mechanic name)
- [ ] `config.description` frames the level around the probability concept being learned
- [ ] `config.passCriteria` defined
- [ ] `LevelModule` satisfies `lib/levelInterface.ts` contract

### `LevelXSession.tsx`
- [ ] No fullscreen modal — tutor messages always appear in the sidebar
- [ ] During forced phases: game action buttons disabled; sidebar shows acknowledge button
- [ ] During practice phases: sidebar shows "Get Hint" button and student chat input
- [ ] HUD shows anchor probability stat at all times
- [ ] HUD shows live decision stat (player bust probability) during `player-turn`
- [ ] Probability values color-coded meaningfully (red = danger, green = favorable)
- [ ] LLM errors display gracefully without crashing

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor sidebar is always visible and never covers the game board
- [ ] HUD probability stats update correctly as hands are played
- [ ] Tutor feedback cites specific numbers from the HUD, not generic advice
- [ ] Student chat question returns a probability-focused response
- [ ] Pass condition triggers correctly
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
