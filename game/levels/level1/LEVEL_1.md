# Blackjack Probability Tutor Lesson Plan (Revised Scope)

## Core Learning Goal

Teach users how probability supports better decision-making through blackjack basic strategy.

Frame blackjack as a structured probability environment. Emphasize decision quality over outcomes, without introducing formal expected value terminology.

---

# Lesson Structure

## Stage 0: Blackjack Basics

### Goal
Teach the minimum rules required to make decisions.

### Concepts
- Card values:
  - Number cards = face value
  - Face cards = 10
  - Ace = 1 or 11
- Goal: get closer to 21 than dealer without busting
- Player actions:
  - Hit
  - Stand
- Dealer upcard provides partial information

### Tutor Behavior
Brief explanation, then immediate interaction.

### Gameplay
Scripted hands only.

### Advancement
User can:
- Identify hand total
- Identify dealer upcard
- Recognize available actions

---

## Stage 1: First Decisions — Hit or Stand

### Goal
Introduce dependency between player hand and dealer upcard.

### Concepts
- Bust risk
- Dealer strength:
  - Weak: 2–6
  - Strong: 7–Ace
- Hard totals

### Tutor Framing
> Decisions depend on your hand and the dealer’s visible card.

### Gameplay Pattern
1. Show hand
2. Ask user for action
3. Ask:
   - “What is your total?”
   - “Is the dealer strong or weak?”
4. User decides
5. Tutor explains using basic strategy

### Advancement
User correctly handles 5 guided decisions.

---

## Stage 2: Bust Probability

### Goal
Teach users to estimate risk when hitting.

### Concepts
- Bust cards vs safe cards
- Probability as proportion of helpful vs harmful outcomes

### Required Game Logic
App calculates:
- Bust probability
- Relevant card counts

LLM only explains provided values.

### Gameplay
1. User estimates risk (low/medium/high)
2. App reveals probability
3. User chooses action
4. Tutor explains

### Advancement
User demonstrates understanding that:
- High bust risk does not always mean Stand
- Low bust risk does not always mean Hit

---

## Stage 3: Dealer Bust Probability

### Goal
Explain why dealer upcard changes optimal behavior.

### Concepts
- Dealer forced rules
- Weak dealer cards increase dealer bust likelihood
- Player sometimes benefits from doing nothing

### Required Game Logic
App provides dealer bust probabilities.

### Tutor Framing
> Sometimes the best move is to avoid risk and let the dealer make the mistake.

### Gameplay
1. User classifies dealer card (weak/strong)
2. App reveals dealer bust probability
3. User chooses action
4. Tutor explains

### Advancement
User consistently recognizes:
- Dealer 2–6 as weak pressure cards

---

## Stage 4: Decision Quality Over Outcomes

### Goal
Reinforce that correct decisions are defined by long-term success, not immediate results.

### Concepts
- A correct decision can lose
- An incorrect decision can win
- Strategy is about consistency over time

### Tutor Framing
> The goal is not to win this hand. The goal is to make the kind of decision that wins more often over many similar hands.

### Required Game Logic
App provides:
- Basic strategy action
- Outcome of hand

### Gameplay Pattern
1. User chooses action
2. App reveals:
   - User action
   - Correct strategy action
   - Outcome
3. Tutor evaluates:
   - Decision quality (correct/incorrect)
   - Separates decision from result

### Tutor Response Structure
```text
Decision: [Correct / Not optimal]
Result: [Win / Loss]
Explanation:
- Your hand: [...]
- Dealer card: [...]
- Key idea: [bust risk / dealer weakness]
Takeaway: [short statement about consistency]