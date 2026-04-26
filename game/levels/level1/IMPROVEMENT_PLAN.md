# Level 1 Basic Probability Improvement Plan

## Summary

Level 1 should teach a custom beginner model called **basic probability**, not basic strategy.

The student should always assume the dealer hidden card is worth 10, then add that to the visible dealer upcard to get the **assumed dealer total**. The board and game logic should compute the correct action, correctness, and explanation facts. The tutor should only present those facts conversationally.

The main goal is to prevent tutor contradictions such as:

- "Correct - you chose hit, and probability says stand."
- Saying a soft hand can bust when the app-provided bust fraction is `0 out of 52`.

Actual dealer play must stay unchanged. The dealer still reveals and plays by normal blackjack dealer rules using the real hidden card.

## Current Problems

1. The app and tutor prompt both try to decide what the rule means.
   - The app passes `decision_result`, `student_action`, and `level1_probability_action`.
   - The prompt also describes cases and asks the LLM to reason from them.
   - When those differ, the tutor can produce contradictory feedback.

2. The current probability resolver does not match the clarified rule.
   - Current behavior allows Hit on totals up to 11 against an assumed dealer total of 12-16.
   - Desired behavior is stricter: when dealer is assumed 12-16, the player should stand unless they have a hard total below 10.

3. Too much raw context is passed to the tutor.
   - The tutor receives many fields and must decide which ones matter.
   - This lets it invent or mix explanations, especially around soft hands and bust risk.

4. Stage/reflection prompts still ask the LLM to explain the rule.
   - The LLM should not infer math or decide whether Hit/Stand is correct.
   - The app should compute the explanation sentence and pass it in.

## Canonical Level 1 Rule

Use one rule function for all decision scoring and tutor facts.

### Dealer Assumption

Assume the dealer hidden card is worth 10.

| Dealer Upcard | Assumed Dealer Total |
| --- | ---: |
| 2 | 12 |
| 3 | 13 |
| 4 | 14 |
| 5 | 15 |
| 6 | 16 |
| 7 | 17 |
| 8 | 18 |
| 9 | 19 |
| 10/J/Q/K | 20 |
| A | 21 |

### Decision Rule

If the assumed dealer total is **12-16**:

```ts
if hand is hard and playerTotal < 10:
  hit
else:
  stand
```

Teaching reason:

- The dealer is assumed below 17 and would need another card.
- The student should hit less often and let the dealer take the bust risk.
- The exception is a hard total below 10, where one hit cannot bust the player.

If the assumed dealer total is **17-21**:

```ts
if playerTotal < 17:
  hit
else:
  stand
```

Teaching reason:

- The dealer is assumed to have a strong made hand.
- The student should hit if they are below 17 and trying to catch up.
- Once the student has 17 or higher, they stop.

## Required Rule Checks

Dealer assumed 12-16:

| Player Hand | Dealer Upcard | Expected |
| --- | --- | --- |
| Hard 8 | 6 | Hit |
| Hard 9 | 6 | Hit |
| Hard 10 | 6 | Stand |
| Hard 11 | 6 | Stand |
| Hard 15 | 6 | Stand |
| Soft 14 | 6 | Stand |

Dealer assumed 17-21:

| Player Hand | Dealer Upcard | Expected |
| --- | --- | --- |
| Hard 14 | 7 | Hit |
| Hard 16 | A | Hit |
| Hard 17 | 10 | Stand |
| Hard 20 | A | Stand |
| Soft 14 | 10 | Hit |
| Soft 17 | 10 | Stand |

## Implementation Changes

### 1. Simplify `gameLogic.ts`

File:

```txt
game/levels/level1/gameLogic.ts
```

Update `getLevel1ProbabilityAction()` to exactly match the canonical rule:

```ts
export function getLevel1ProbabilityAction(
  playerHand: Card[],
  dealerUpcard: Card
): "hit" | "stand" {
  const total = calculateHandValue(playerHand);
  const soft = isSoft(playerHand);
  const assumedDealerTotal = getAssumedDealerTotal(dealerUpcard) ?? 20;

  if (assumedDealerTotal <= 16) {
    return !soft && total < 10 ? "hit" : "stand";
  }

  return total < 17 ? "hit" : "stand";
}
```

### 2. Add a Single Decision Review Builder

Add a deterministic app-level builder, for example:

```ts
interface Level1DecisionReview {
  decisionIndex: number;
  studentAction: "hit" | "stand";
  correctAction: "hit" | "stand";
  isCorrect: boolean;
  playerTotalLabel: string;
  dealerUpcard: string;
  assumedDealerTotal: number;
  caseType: "dealer_bust_risk" | "dealer_strong";
  playerBustFraction: string;
  assumedDealerBustFraction: string;
  openingSentence: string;
  reasonSentence: string;
  reflectionQuestion: string;
}
```

This builder should use the stored decision snapshot, not the current post-action hand.

The app should generate these strings, not the LLM:

```txt
openingSentence
reasonSentence
reflectionQuestion
```

### 3. Generate Case-Based Reason Sentences in Code

For assumed dealer totals 12-16:

```txt
The dealer shows 6, so we assume 16; that means the dealer would need another card, and 32 out of 52 cards would bust that assumed total.
```

For the hard-total-below-10 exception:

```txt
Your hard 9 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
```

For assumed dealer totals 17-21:

```txt
The dealer shows 7, so we assume 17; your hard 14 is below that strong assumed total, so the rule says hit even though 24 out of 52 cards would bust you.
```

For soft hands:

```txt
Your soft 14 has 0 out of 52 bust cards on one hit, because the Ace can adjust from 11 to 1.
```

Never let the tutor invent whether a soft hand can bust.

### 4. Simplify Decision Feedback Context

Replace the current broad decision context with a small, direct context:

```txt
message_type: decision_feedback
must_say_opening: Correct - you chose hit, and the Level 1 probability rule says hit.
must_say_reason: Your hard 9 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
must_ask_question: What mattered most in your choice?
```

The tutor should not receive multiple fields that invite recomputation unless they are strictly needed for display.

### 5. Simplify Reflection Context

After the student answers the reflection question, pass the same review:

```txt
message_type: feedback_reflection_answer
student_answer: "..."
must_say_reason: Your hard 9 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
```

Tutor response target:

```txt
That is the right kind of factor to notice. Your hard 9 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
```

No new question. No new math. No new decision.

### 6. Update `tutorPrompts.ts`

File:

```txt
game/levels/level1/tutorPrompts.ts
```

Rewrite the decision feedback prompt so the tutor does not reason from the rule.

Required behavior:

- Use `must_say_opening` exactly.
- Use `must_say_reason` exactly or lightly rephrase without changing meaning.
- Ask `must_ask_question` exactly.
- Do not contradict `correctAction`.
- Do not infer a different action from assumed dealer total.
- Do not say a soft hand can bust if the provided fraction is `0 out of 52`.

Decision feedback prompt should be closer to:

```txt
The app has already computed the decision result and explanation.
Do not re-evaluate the rule.
Sentence 1: copy must_say_opening exactly.
Sentence 2: use must_say_reason exactly or lightly rephrase without changing the action, numbers, or meaning.
Sentence 3: copy must_ask_question exactly.
The response must contain exactly one question mark.
```

Update reflection prompt similarly:

```txt
Use must_say_reason. Do not recompute, add a different recommendation, or ask another question.
```

### 7. Simplify Stage Answer Contexts

Stage prompts should stop asking the LLM to explain the whole rule from raw fields.

For stage questions and answers, pass small facts:

```txt
correct_assumed_dealer_total
comparison_label
player_bust_fraction_if_hit
assumed_dealer_bust_fraction_if_forced_to_hit
stage_answer_sentence
```

When possible, generate `stage_answer_sentence` in code.

Example:

```txt
stage_answer_sentence: Yes - the dealer shows 6, so we assume 16.
```

or

```txt
stage_answer_sentence: Your soft 14 has 0 out of 52 bust cards if you hit.
```

### 8. Keep Gameplay Flow Unchanged

Do not change actual dealer play:

- Dealer still reveals the real hidden card at the normal time.
- Dealer still hits/stands according to actual blackjack dealer rules.
- Win/loss/push still uses actual hand totals.

Do not change the current per-decision tutor gate unless necessary:

- Student chooses Hit or Stand.
- App records the pre-action decision snapshot.
- Tutor gives feedback and asks one question.
- Student answers.
- Play resumes.

## Test Plan

### Logic Tests

Verify `getLevel1ProbabilityAction()`:

```txt
Hard 8 vs dealer 6 -> Hit
Hard 9 vs dealer 6 -> Hit
Hard 10 vs dealer 6 -> Stand
Hard 11 vs dealer 6 -> Stand
Hard 15 vs dealer 6 -> Stand
Soft 14 vs dealer 6 -> Stand
Hard 14 vs dealer 7 -> Hit
Hard 16 vs dealer A -> Hit
Hard 17 vs dealer 10 -> Stand
Hard 20 vs dealer A -> Stand
Soft 14 vs dealer 10 -> Hit
Soft 17 vs dealer 10 -> Stand
```

### Context Tests

For each scenario above, verify decision feedback context contains:

```txt
must_say_opening
must_say_reason
must_ask_question
```

and does not contain contradictory raw fields that ask the LLM to re-decide the action.

### Tutor Output Tests

Verify:

- No response says `Correct` while recommending the opposite action.
- No response says a soft hand busts when `player_bust_fraction_if_hit` is `0 out of 52`.
- Decision feedback has exactly one question.
- Reflection reply has no question.
- Feedback references the actual student action.
- Feedback references the app-computed correct action.

### Commands

Run targeted lint:

```bash
npx eslint game/levels/level1/gameLogic.ts game/levels/level1/tutorPrompts.ts components/levels/Level1Session.tsx
```

Run build:

```bash
npm run build
```

Full-project lint may still fail on unrelated non-Level-1 files; do not edit other levels unless they block Level 1 behavior.
