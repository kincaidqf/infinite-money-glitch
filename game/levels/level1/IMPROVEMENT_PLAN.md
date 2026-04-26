# Level 1 Basic Probability Improvement Plan

## Summary

Level 1 should teach a custom beginner model called **basic probability**, not basic strategy.

The student always assumes the dealer's hidden card is worth 10, adds that to the upcard to get the **assumed dealer total**, then applies the Level 1 rule. The board and game logic compute the correct action, correctness, and all explanation facts. The tutor's job is to present those facts conversationally — it must never re-derive correctness or invent numbers.

The principle that governs all implementation decisions:

> **App computes. Tutor formats.**

The app is the sole source of correctness: what action is right, what fractions apply, which case type the hand falls into. The tutor receives these as pre-computed facts and uses them to speak naturally. The tutor retains conversational ability and warmth; it loses the ability to contradict the app.

Actual dealer play must stay unchanged. The dealer still reveals and plays by normal blackjack dealer rules using the real hidden card.

---

## Current Problems

1. The app and tutor prompt both try to decide what the rule means.
   - The app passes `decision_result`, `student_action`, and `level1_probability_action`.
   - The prompt also describes cases and asks the LLM to reason from them.
   - When those differ the tutor produces contradictory feedback.

2. The current probability resolver does not correctly exclude soft hands from the exception branch.
   - Current behavior allows Hit on any hand with total <= 11, including soft hands.
   - Correct behavior: the exception applies to **hard** totals only (hard total <= 11 cannot bust from one hit).

3. Too much raw context is passed to the tutor.
   - Many fields invite re-computation instead of formatting.
   - Soft hand bust risk and correctness labels are especially prone to LLM invention.

4. The opening sentence of decision feedback is passed as an instruction ("use this"), not as delivered content.
   - The LLM can paraphrase it incorrectly, changing the action label while keeping "Correct -".
   - Moving it to the user message makes it immutable.

5. The reflection context still passes all raw decision fields, inviting re-reasoning.

6. `cleanTutorText` in `Level1Session.tsx` does not strip new `must_say` field names if the LLM echoes them.

7. `HandDecision` and a proposed `Level1DecisionReview` would be two parallel representations that can drift.

---

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
if hand is hard AND playerTotal <= 11:
  hit   // cannot bust from one hit — safe to close the gap
else:
  stand // let the dealer take the bust risk
```

Teaching reason:

- The dealer is assumed below 17 and must keep hitting under house rules.
- Standing lets the dealer take the bust risk.
- The exception is a **hard** total of 11 or lower: one hit cannot bust the player (highest possible card is 10, giving at most 21), so hitting is safe even against a weak dealer.
- Soft hands always stand against assumed 12-16. A soft hand already carries an Ace worth 11; the right play is to protect that strong position and force the dealer to risk busting.

If the assumed dealer total is **17-21**:

```ts
if playerTotal < 17:
  hit
else:
  stand
```

Teaching reason:

- The dealer is assumed to have a strong made hand and will stop.
- The student must hit until reaching 17 or higher to have any chance.

---

## Case Types

Every decision maps to exactly one of three case types. The app assigns the case type — the tutor never infers it.

| Case | Condition | Correct Action |
| --- | --- | --- |
| `dealer_bust_risk` | Assumed 12-16 AND (soft OR hard >= 12) | Stand |
| `dealer_bust_risk_exception` | Assumed 12-16 AND hard <= 11 | Hit |
| `dealer_strong` | Assumed 17-21 | Hit if player < 17, else Stand |

The `dealer_bust_risk_exception` reason differs from `dealer_bust_risk`. The tutor must use the provided reason sentence and must not fall back to "let the dealer bust" language when the case is `dealer_bust_risk_exception`.

---

## Required Rule Checks

Dealer assumed 12-16:

| Player Hand | Dealer Upcard | Expected | Case Type |
| --- | --- | --- | --- |
| Hard 8 | 6 | Hit | `dealer_bust_risk_exception` |
| Hard 9 | 6 | Hit | `dealer_bust_risk_exception` |
| Hard 10 | 6 | Hit | `dealer_bust_risk_exception` |
| Hard 11 | 6 | Hit | `dealer_bust_risk_exception` |
| Hard 12 | 6 | Stand | `dealer_bust_risk` |
| Hard 15 | 6 | Stand | `dealer_bust_risk` |
| Soft 14 | 6 | Stand | `dealer_bust_risk` |

Dealer assumed 17-21:

| Player Hand | Dealer Upcard | Expected | Case Type |
| --- | --- | --- | --- |
| Hard 14 | 7 | Hit | `dealer_strong` |
| Hard 16 | A | Hit | `dealer_strong` |
| Hard 17 | 10 | Stand | `dealer_strong` |
| Hard 20 | A | Stand | `dealer_strong` |
| Soft 14 | 10 | Hit | `dealer_strong` |
| Soft 17 | 10 | Stand | `dealer_strong` |

---

## Implementation Changes

### 1. Update `getLevel1ProbabilityAction()` in `gameLogic.ts`

```ts
export function getLevel1ProbabilityAction(
  playerHand: Card[],
  dealerUpcard: Card
): "hit" | "stand" {
  const total = calculateHandValue(playerHand);
  const soft = isSoft(playerHand);
  const assumedDealerTotal = getAssumedDealerTotal(dealerUpcard) ?? 20;

  if (assumedDealerTotal <= 16) {
    // Exception: a hard total <= 11 cannot bust from one hit, so hitting is safe.
    // Soft hands always stand — protect the Ace-11 position.
    return !soft && total <= 11 ? "hit" : "stand";
  }

  return total < 17 ? "hit" : "stand";
}
```

### 2. Add `getCaseType()` in `gameLogic.ts`

```ts
export type Level1CaseType =
  | "dealer_bust_risk"
  | "dealer_bust_risk_exception"
  | "dealer_strong";

export function getCaseType(
  playerHand: Card[],
  assumedDealerTotal: number
): Level1CaseType {
  if (assumedDealerTotal <= 16) {
    const total = calculateHandValue(playerHand);
    const soft = isSoft(playerHand);
    return !soft && total <= 11 ? "dealer_bust_risk_exception" : "dealer_bust_risk";
  }
  return "dealer_strong";
}
```

### 3. Replace `HandDecision` with `Level1DecisionReview`

**Recommendation:** `Level1DecisionReview` replaces `HandDecision` entirely in state. There should be one canonical decision record, not two parallel representations. Build it completely at decision time in `recordDecision()`, including all pre-computed reason and opening fields. Store it directly in `state.handDecisions`.

```ts
export interface Level1DecisionReview {
  decisionIndex: number;
  studentAction: "hit" | "stand";
  correctAction: "hit" | "stand";
  isCorrect: boolean;
  playerHandAtDecision: Card[];
  playerTotalLabel: string;          // e.g. "hard 15" or "soft 14"
  dealerUpcard: string;              // rank string
  dealerUpcardCard: Card | null;
  assumedDealerTotal: number;
  caseType: Level1CaseType;
  playerBustFraction: string;        // e.g. "32 out of 52"
  assumedDealerBustFraction: string; // e.g. "24 out of 52" or "0 out of 52"
  openingSentence: string;           // fully computed; delivered to student directly
  reasonSentence: string;            // fully computed; tutor uses this verbatim or near-verbatim
  reflectionQuestion: string;        // fully computed; tutor asks this exactly
}
```

Rename all references from `HandDecision` to `Level1DecisionReview` throughout `gameLogic.ts`, `Level1State`, and `Level1Session.tsx`.

### 4. Add `buildReasonSentence()` and `buildReflectionQuestion()` in `gameLogic.ts`

Generate reason sentences deterministically for each case type. The tutor must not invent these.

```ts
function buildReasonSentence(
  caseType: Level1CaseType,
  playerTotalLabel: string,
  dealerUpcard: string,
  assumedDealerTotal: number,
  playerBustFraction: string,
  assumedDealerBustFraction: string
): string {
  if (caseType === "dealer_bust_risk") {
    return `The dealer shows ${dealerUpcard}, so we assume ${assumedDealerTotal}; ` +
      `${assumedDealerBustFraction} cards would bust that assumed total, ` +
      `so standing lets the dealer take the risk.`;
  }
  if (caseType === "dealer_bust_risk_exception") {
    return `Your ${playerTotalLabel} cannot bust from one hit, ` +
      `so the rule lets you take one safe card even though the dealer is assumed at ${assumedDealerTotal}.`;
  }
  // dealer_strong
  return `The dealer shows ${dealerUpcard}, so we assume ${assumedDealerTotal}; ` +
    `your ${playerTotalLabel} is below that strong assumed total, ` +
    `and ${playerBustFraction} cards would bust you if you hit.`;
}

function buildReflectionQuestion(caseType: Level1CaseType): string {
  if (caseType === "dealer_bust_risk") return "What made you decide to stand?";
  if (caseType === "dealer_bust_risk_exception") return "Why is it safe to hit here even though the dealer looks weak?";
  return "What were you thinking about when you made that call?";
}
```

### 5. Build `openingSentence` in `recordDecision()`

```ts
const openingSentence = correct
  ? `Correct — you chose ${action}, and the Level 1 probability rule says ${correctAction}.`
  : `Not quite — you chose ${action}, but the Level 1 probability rule says ${correctAction}.`;
```

### 6. Change How Decision Feedback Context Is Delivered

The opening sentence has already been shown to the student as the first line of the tutor response. Put it in the **user message** (the context string), not as an instruction. The system prompt then tells the tutor: "The opening sentence was already delivered. Add only the reason and one question."

New `getHandFeedbackContext()` shape:

```txt
message_type: decision_feedback
delivered_opening: Correct — you chose hit, and the Level 1 probability rule says hit.
case_type: dealer_bust_risk_exception
must_use_reason: Your hard 11 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
must_ask_question: Why is it safe to hit here even though the dealer looks weak?
player_total_label: hard 11
dealer_upcard: 6
assumed_dealer_total: 16
player_bust_fraction_if_hit: 0 out of 52
assumed_dealer_bust_fraction_if_forced_to_hit: 32 out of 52
```

The tutor system prompt should say:

```txt
The opening sentence in delivered_opening has already been shown to the student.
Do not repeat or rephrase it.
Your response adds exactly two things:
- Sentence 1: use must_use_reason exactly or rephrase without changing the action, numbers, or case type.
- Sentence 2: ask must_ask_question exactly.
Do not contradict correctAction. Do not infer a different case type. Do not invent fractions.
```

### 7. Simplify Reflection Context

Replace the raw `getDecisionFactLines()` dump with a compact packet drawn from the stored `Level1DecisionReview`.

New `getFeedbackReflectionContext()` shape:

```txt
message_type: feedback_reflection_answer
student_answer: "..."
case_type: dealer_bust_risk_exception
must_use_reason: Your hard 11 cannot bust from one hit, so the rule lets you take one safe card even though the dealer is assumed at 16.
player_total_label: hard 11
dealer_upcard: 6
assumed_dealer_total: 16
player_bust_fraction_if_hit: 0 out of 52
assumed_dealer_bust_fraction_if_forced_to_hit: 32 out of 52
```

The tutor system prompt should say:

```txt
Acknowledge the student's answer briefly (1 sentence). Then use must_use_reason to explain why
the decision was correct or not. Do not add a new question. Do not contradict case_type.
```

The tutor retains judgment on tone and acknowledgment phrasing. It loses the ability to change the reason facts.

### 8. Stage Answer Contexts — Pass Key Facts, Prevent Contradictions

Stage answers should still allow the tutor to respond conversationally. The fix is not to pre-generate every sentence but to pass `answer_result` (app-computed correctness), the authoritative computed values, and a constraint not to contradict them.

Stage 1 answer context change:

- Add `answer_result: correct | incorrect` (app computes this — the tutor must not re-derive it).
- Keep `correct_assumed_dealer_total` as the authoritative number.
- Tutor confirms or corrects based on `answer_result`; it uses `correct_assumed_dealer_total` for any number it speaks.

Stage 2 answer context change:

- Add `answer_result: correct | incorrect`.
- Keep `correct_comparison` as the authoritative label.
- Tutor constraint: must not use a comparison word that contradicts `correct_comparison`.

Stage 3 answer context change:

- Pass `player_bust_fraction_if_hit` and `assumed_dealer_bust_fraction_if_forced_to_hit` as authoritative.
- Pass `level1_probability_action` as authoritative.
- Tutor constraint: must not name a fraction that differs from provided values; must not recommend an action that contradicts `level1_probability_action`.

Tutor system prompt addition for all stage answer types:

```txt
answer_result tells you whether the student was correct. Do not re-derive it.
Use only the numbers provided in context. Do not invent fractions or totals.
```

### 9. Hint Context — Pass Key Facts, Let Tutor Speak

The hint prompt currently asks the LLM to compare the player's total with the assumed total. That is reasoning. Instead, pass the pre-computed values and constrain contradiction.

New hint context shape:

```txt
message_type: hint
assumed_dealer_total: 16
case_type: dealer_bust_risk
level1_probability_action: stand
player_bust_fraction_if_hit: 32 out of 52
assumed_dealer_bust_fraction_if_forced_to_hit: 24 out of 52
```

Updated hint system prompt:

```txt
Give a 1 to 2 sentence hint using the facts in context.
Do not reveal level1_probability_action directly — let the student decide.
Do not recommend an action that contradicts level1_probability_action.
Do not invent fractions. Use only the values provided.
Ask exactly one question.
```

The tutor retains full voice for the hint. The constraint is only on invented numbers and action contradictions.

### 10. Update `cleanTutorText` in `Level1Session.tsx`

Add the new field names to the `metadataLine` regex so they are stripped if the LLM echoes them back:

```
delivered_opening | must_use_reason | must_ask_question | case_type | answer_result | level1_probability_action_hidden | player_total_label
```

### 11. Update `tutorPrompts.ts`

**feedback prompt** — Replace the "Case A / Case B" reasoning block entirely. The tutor no longer determines which case applies; the app passes `case_type`. The new prompt:

```txt
ROLE: You are a blackjack basic probability tutor for a beginner.

SCOPE: Level 1 teaches Hit, Stand, the assume-10 dealer rule, and fraction-based bust risk. Correctness, case type, and all fractions are already computed by the app. Treat them as absolute.

FORMAT:
The opening sentence has already been delivered (delivered_opening). Do not repeat it.
Write exactly two sentences:
  Sentence 1 — use must_use_reason exactly or rephrase lightly without changing the action, numbers, or case type.
  Sentence 2 — ask must_ask_question exactly.
The response must contain exactly one question mark.

CONSTRAINT:
- Do not contradict case_type or correctAction.
- Do not invent fractions. Use only values from context.
- Do not say a soft hand can bust if player_bust_fraction_if_hit is "0 out of 52".
- Do not mention Split, Double, card counting, betting, or expected value.
- Do not say the dealer definitely has a 10 hidden. Say "we assume".
```

**explanation prompt** — Retain conversational structure. Add the following constraint block that applies to all message types:

```txt
GLOBAL CONSTRAINT:
- Never contradict answer_result. If answer_result is "correct", confirm. If "incorrect", correct.
- Never invent fractions. Use only values provided in context.
- Never recommend an action that contradicts level1_probability_action when it is provided.
- Never say a soft hand can bust if player_bust_fraction_if_hit is "0 out of 52".
- Do not mention Split, Double, card counting, betting, or expected value.
```

### 12. Codify the "App Computes, Tutor Formats" Principle in `CLAUDE.md`

Add to the **LLM Integration Rules** section:

```txt
### Architecture Rule — App Computes, Tutor Formats

The app is the sole source of correctness for every level. This means:

- Decision correctness (right or wrong) is determined by game logic, never by the LLM.
- All numeric values (bust fractions, totals, counts) are computed by the app and passed as
  pre-computed strings. The LLM never calculates.
- Case types and action labels are assigned in code. The LLM never infers which rule applies.
- The LLM's role is to take pre-computed facts and deliver them in a warm, conversational tone.

Context objects passed to the tutor should include computed fact fields, not raw game state
fields that require interpretation. If a context field requires the LLM to compare two numbers
or classify a scenario, that comparison or classification belongs in the app, not the prompt.
```

---

## Gameplay Flow — Unchanged

Do not change actual dealer play:

- Dealer still reveals the real hidden card at the normal time.
- Dealer still hits/stands according to actual blackjack dealer rules.
- Win/loss/push still uses actual hand totals.

Do not change the current per-decision tutor gate:

- Student chooses Hit or Stand.
- App records the pre-action `Level1DecisionReview` snapshot.
- Tutor delivers `openingSentence` (from delivered_opening in context), then adds reason and question.
- Student answers.
- Play resumes.

---

## Test Plan

### Logic Tests

Verify `getLevel1ProbabilityAction()` and `getCaseType()`:

```txt
Hard 8  vs dealer 6  → Hit,   dealer_bust_risk_exception
Hard 9  vs dealer 6  → Hit,   dealer_bust_risk_exception
Hard 10 vs dealer 6  → Hit,   dealer_bust_risk_exception
Hard 11 vs dealer 6  → Hit,   dealer_bust_risk_exception
Hard 12 vs dealer 6  → Stand, dealer_bust_risk
Hard 15 vs dealer 6  → Stand, dealer_bust_risk
Soft 14 vs dealer 6  → Stand, dealer_bust_risk
Hard 14 vs dealer 7  → Hit,   dealer_strong
Hard 16 vs dealer A  → Hit,   dealer_strong
Hard 17 vs dealer 10 → Stand, dealer_strong
Hard 20 vs dealer A  → Stand, dealer_strong
Soft 14 vs dealer 10 → Hit,   dealer_strong
Soft 17 vs dealer 10 → Stand, dealer_strong
```

### Context Tests

For each scenario above, verify the decision feedback context contains:

- `delivered_opening` with the correct action label matching the scenario
- `must_use_reason` matching the case type (not mixing "let the dealer bust" with exception language)
- `must_ask_question` matching the case type
- No raw fields that invite re-computation of the action

### Tutor Output Tests

Verify:

- No response says "Correct" while naming the opposite action.
- No response says a soft hand busts when `player_bust_fraction_if_hit` is "0 out of 52".
- Decision feedback response contains exactly one question mark.
- Reflection reply contains no question mark.
- Feedback reason matches the case type (exception hands do not receive "let the dealer bust" framing).
- `delivered_opening` is not repeated verbatim in the tutor's response.

### Commands

Run targeted lint:

```bash
npx eslint game/levels/level1/gameLogic.ts game/levels/level1/tutorPrompts.ts components/levels/Level1Session.tsx
```

Run build:

```bash
npm run build
```

Full-project lint may still fail on unrelated non-Level-1 files. Do not edit other levels unless they block Level 1 behavior.
