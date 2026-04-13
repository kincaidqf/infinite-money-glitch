# Level X — [Level Title]

> **Template instructions:** Replace every `[PLACEHOLDER]` with level-specific content before implementation begins. Delete this callout block when done.

---

## Overview

| Field | Value |
|---|---|
| Level ID | X |
| Title | [e.g. "Basic Strategy"] |
| Description | [1-sentence player-facing description shown on the level select screen] |
| Pass Criteria | [e.g. "≥70% correct decisions across a full simulated shoe"] |
| Files owned | `game/levels/levelX/**` + `components/levels/LevelXSession.tsx` |

---

## Learning Goals

What the player should understand by the end of this level:

1. [Primary concept — e.g. "How to read a Basic Strategy chart"]
2. [Secondary concept]
3. [Optional tertiary concept]

What this level explicitly does NOT cover (to maintain scope boundaries with adjacent levels):

- [e.g. "Card counting — first introduced in Level 2"]
- [e.g. "Bet sizing — not covered until Level 3"]

---

## Game Mechanics

### Player Actions Available
- [ ] Hit
- [ ] Stand
- [ ] Double Down
- [ ] Split
- [ ] Surrender
- [ ] [Other — describe]

### Win / Progression Condition
[Describe exactly what metric(s) determine a pass. E.g. "Player achieves ≥70% Basic Strategy accuracy over a minimum of 20 decisions in a single session."]

### State Shape (`LevelXState`)

Document every field that belongs in this level's state object. Each field that differs from Level 1's baseline must have a justification.

```ts
export interface LevelXState {
  phase: "dealing" | "player-turn" | "dealer-turn" | "round-over" | "session-over";
  playerHand: Card[];
  dealerHand: Card[];
  correctDecisions: number;
  totalDecisions: number;
  sessionComplete: boolean;
  lastFeedback: string | null;
  // --- Level X additions ---
  // [fieldName]: [type]; // Reason: [why this level needs it]
}
```

---

## Probability / Math Component

This section is the authoritative spec for all probability calculations in `gameLogic.ts`. Every formula listed here must be implemented as a named, pure function.

### Concept Being Taught

[Describe in plain English what probability concept the player is learning. E.g. "How removing known cards from the shoe shifts the probability of busting on a hit."]

### Required Calculations

List each calculation the game logic must perform. For each one, specify:

#### [Calculation Name — e.g. `getBustProbability`]

- **Purpose:** [What question this answers for the player or tutor]
- **Inputs:** [Parameters, e.g. `playerTotal: number, shoe: Shoe`]
- **Output:** [Return type and meaning, e.g. `number` between 0–1 representing bust probability]
- **Formula / Algorithm:**
  ```
  [Write the math or pseudocode here. Be precise enough that an implementer has no ambiguity.]
  ```
- **Edge cases:** [Any inputs that need special handling]

#### [Next Calculation Name]

- **Purpose:**
- **Inputs:**
- **Output:**
- **Formula / Algorithm:**
  ```
  ```
- **Edge cases:**

### How Math Results Surface in the UI

[Describe how/where the calculated probabilities are displayed. E.g. "Show bust probability as a percentage in the game panel. Do not show it before the player makes a decision — reveal it in the post-decision feedback."]

---

## Tutor Prompts

All three prompt strings below go in `tutorPrompts.ts`. They must follow the four-part structure: **Role / Scope / Format / Constraint**.

### `feedback` prompt

```
Role: [What the tutor is in this context]
Scope: [What subject/concepts the tutor covers at this level — be explicit about exclusions]
Format: [Length, tone, plain text or markdown]
Constraint: [What the tutor must NOT do]
```

Full prompt text:

```
[Paste the complete system prompt string here]
```

### `hint` prompt

```
Role:
Scope:
Format:
Constraint:
```

Full prompt text:

```
[Paste the complete system prompt string here]
```

### `explanation` prompt

```
Role:
Scope:
Format:
Constraint:
```

Full prompt text:

```
[Paste the complete system prompt string here]
```

### What game state must be included in every LLM call

`getGameContext()` in `gameLogic.ts` must return a plain-English string containing at minimum:

- [ ] Level number and title
- [ ] Player hand (ranks)
- [ ] Dealer upcard
- [ ] Current phase
- [ ] Decisions correct / total
- [ ] [Any level-specific context fields — list them here]

---

## Shared Utilities

List the shared modules this level imports. Do not import utilities your level does not use.

| Utility | Import path | Used for |
|---|---|---|
| `calculateHandValue` | `@/game/cardUtils` | [e.g. Determining player total for bust check] |
| `isSoft` | `@/game/cardUtils` | |
| `isBust` | `@/game/cardUtils` | |
| `getBasicStrategyAction` | `@/game/basicStrategy` | |
| `evaluateDecision` | `@/game/basicStrategy` | |
| `initShoe` | `@/game/deckState` | |
| `dealCard` | `@/game/deckState` | |
| `getProbabilities` | `@/game/deckState` | |

Remove rows for utilities not used by this level.

---

## Out-of-Scope Guardrails

The tutor and game logic for this level must never:

- [ ] [e.g. Mention card counting or running/true count]
- [ ] [e.g. Suggest bet sizing changes]
- [ ] [e.g. Reference content from Level X+1 or higher]
- [ ] Reveal the correct action before the player has decided
- [ ] Send player PII to the LLM

---

## Implementation Checklist

Use this to track completion before merging.

### `gameLogic.ts`
- [ ] `LevelXState` interface defined
- [ ] `getInitialLevelXState()` implemented
- [ ] `getLevelXGameContext(state)` returns complete plain-English summary
- [ ] All required probability functions implemented (see Math Component section)
- [ ] All functions are pure — no DOM, no React imports, no side effects

### `tutorPrompts.ts`
- [ ] `feedback` prompt written and reviewed
- [ ] `hint` prompt written and reviewed
- [ ] `explanation` prompt written and reviewed
- [ ] All prompts specify Role / Scope / Format / Constraint
- [ ] No out-of-scope content in any prompt

### `index.ts`
- [ ] `LevelModule` satisfies `lib/levelInterface.ts` contract
- [ ] `config.id`, `config.title`, `config.description`, `config.passCriteria` filled in

### `LevelXSession.tsx`
- [ ] Renders game state correctly
- [ ] Triggers tutor calls on appropriate game events
- [ ] Probability values displayed per UI spec above
- [ ] Handles LLM error gracefully (no crash, user-facing message)

### Manual QA
- [ ] Level loads without errors
- [ ] Tutor responds to at least one game event
- [ ] Pass condition triggers correctly
- [ ] No API key visible in network tab or source
- [ ] Works on latest Chrome and Safari
