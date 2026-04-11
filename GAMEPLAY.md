# GAMEPLAY.md — Blackjack Counting Tutor: Comprehensive Gameplay Reference

This document describes every aspect of the current gameplay implementation — mechanics, rules, UI decisions, and the reasoning behind them. It is intended as a single reference for anyone making future changes.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Level System](#2-level-system)
3. [Cards and Deck](#3-cards-and-deck)
4. [Game Phases](#4-game-phases)
5. [Deal Mechanics](#5-deal-mechanics)
6. [Player Actions](#6-player-actions)
7. [Dealer Rules](#7-dealer-rules)
8. [Outcome Resolution](#8-outcome-resolution)
9. [Basic Strategy Evaluation](#9-basic-strategy-evaluation)
10. [UI Layout](#10-ui-layout)
11. [HUD and Statistics](#11-hud-and-statistics)
12. [Session Tracking](#12-session-tracking)
13. [Tutor Integration](#13-tutor-integration)
14. [Deferred / Not Yet Implemented](#14-deferred--not-yet-implemented)

---

## 1. Overview

This is an educational blackjack trainer. Players practice basic strategy and (at higher levels) card counting. After each decision, the game evaluates whether the player chose the correct basic strategy move and displays inline feedback. A tutor chatbot is available for questions but does not proactively interrupt gameplay.

There is no wagering. The educational focus is decision quality and count accuracy, not money.

---

## 2. Level System

There are four levels (type `Level = 1 | 2 | 3 | 4`), unlocked progressively.

| Level | Name (intent) | Key difference |
|-------|--------------|----------------|
| 1 | Basic Strategy | No count display; basic strategy feedback only |
| 2 | Hi-Lo Introduction | Running count and true count shown in HUD; Double is disabled for this level |
| 3 | Count + Strategy | Count + strategy feedback combined |
| 4 | Advanced Practice | Full feature set |

**Unlock logic** (enforced server-side in `app/game/[level]/page.tsx`):

```
highest = progress.highest_level_completed ?? 0
level 1 → always unlocked
level N → unlocked if highest >= N-1; locked otherwise
```

Locked levels redirect to `/`. Accessing a level URL directly while locked also redirects.

---

## 3. Cards and Deck

### Card structure (`lib/cards.ts`)

Each card has:
- `id` — unique string, e.g. `"hearts_A"`
- `suit` — `"hearts" | "diamonds" | "clubs" | "spades"`
- `rank` — `"A" | "2"–"10" | "J" | "Q" | "K"`
- `blackjackValue` — A=11 (soft), J/Q/K=10, number cards = face value
- `hiLoValue` — Hi-Lo counting tag: 2–6 = `+1`, 7–9 = `0`, 10/J/Q/K/A = `-1`

### Shoe (`game/deckState.ts`)

The shoe is initialized with `initShoe(numDecks)`. Currently **1 deck** is used in all levels. Cards are shuffled with Fisher-Yates.

`DeckState` tracks:
- `shoe` — remaining undealt cards
- `dealt` — all cards dealt so far (for reference; not currently displayed)
- `runningCount` — Hi-Lo running count, incremented on each `dealCard()` call using `card.hiLoValue`
- `numDecks` — stored to allow re-initialization

**Reshuffling:** When fewer than 15 cards remain in the shoe at the start of a new hand, the shoe is re-initialized automatically. This is checked inside `newHand()`.

### Hand value (`game/cardUtils.ts`)

Aces start as 11. If the total exceeds 21 and there are aces counted as 11, each such ace is reduced to 1 (subtract 10). This correctly handles multiple aces.

**Soft hand:** A hand is soft if it contains at least one ace AND the hard total (counting all aces as 1) + 10 ≤ 21.

---

## 4. Game Phases

The game cycles through four phases:

| Phase | Description |
|-------|-------------|
| `idle` | No hand in progress. Waiting for the player to deal. |
| `player` | Hand is active. Player makes decisions (hit/stand/double). |
| `dealer` | Dealer plays out automatically (currently instant, no animation). |
| `result` | Hand is resolved. Outcome banner shown. Waiting for next deal. |

State is held in a single `GameState` object in `GameBoard.tsx`:
```ts
{ deck, playerHand, dealerHand, phase, outcome, lastDecision }
```

---

## 5. Deal Mechanics

When the Deal button is pressed during `idle` (or `result`):
1. Four cards are drawn sequentially from the shoe.
2. Deal order: **player card 1 → dealer card 1 (up) → player card 2 → dealer card 2 (hole)**
3. Player and dealer each receive 2 cards.
4. Phase transitions to `player`.
5. The dealer's hole card (index 1) is rendered face-down until the `result` or `dealer` phase.

The Deal button in `result` phase calls `newHand()` which clears the hand state before dealing again. The same "Deal" button label is used in both cases — it simply calls `deal()` in `idle` and `newHand()` in `result`.

---

## 6. Player Actions

Four buttons are always visible on the floor (bottom-left). Their enabled/disabled state changes by phase:

| Button | Active when | Notes |
|--------|-------------|-------|
| Hit | `phase === "player"` | Always active during player turn |
| Stand | `phase === "player"` | Always active during player turn |
| Double | `phase === "player"` AND `playerHand.length === 2` AND `level !== 2` | Disabled on Level 2 by design; also disabled after first hit |
| Split | Never | Button is present but always disabled; not yet implemented |

All four buttons are faded (via the HTML `disabled` attribute, which triggers `opacity: 0.4; cursor: not-allowed` in CSS) when not available. This keeps the layout stable — buttons never disappear or shift.

### Hit
Draws one card from the shoe. If the new total exceeds 21, the hand ends immediately as `player_bust` without running the dealer turn.

### Stand
Triggers the dealer turn immediately. No additional cards drawn for the player.

### Double
Only available on the first decision (2-card hand), except on Level 2. Draws exactly one card. If bust, ends as `player_bust`. If not bust, proceeds to the dealer turn — the player cannot take any more action.

### Split
Not implemented. The button exists as a permanent visual placeholder to indicate the future feature. The basic strategy engine encodes split recommendations internally (see §9), but the game does not execute splits.

---

## 7. Dealer Rules

After `stand` or a non-bust `double`, the dealer plays automatically:

- Dealer hits on any total **< 17**.
- Dealer stands on **17 or higher** (hard or soft 17 — the current implementation uses the hard total via `calculateHandValue`, which resolves aces optimally, so it stands on soft 17 as a side effect).
- The dealer draws from the same shared shoe, updating the running count with each draw.
- All dealer draws happen synchronously in one call (`runDealerTurn`). There is no animation or step-by-step reveal.

---

## 8. Outcome Resolution

Outcomes are resolved by `resolveOutcome(playerHand, dealerHand)` in priority order:

| Priority | Condition | Outcome | Display |
|----------|-----------|---------|---------|
| 1 | Player total = 21 and exactly 2 cards | `blackjack` | "Blackjack! You win!" |
| 2 | Player total > 21 | `player_bust` | "Bust! Dealer wins." |
| 3 | Dealer total > 21 | `dealer_bust` | "Dealer busts — you win!" |
| 4 | Player total > dealer total | `player_win` | "You win!" |
| 5 | Dealer total > player total | `dealer_win` | "Dealer wins." |
| 6 | Equal totals | `push` | "Push — it's a tie." |

### Result banner
- Displayed as an **overlay centered on the felt table**, appearing only after a hand concludes.
- **Green** (`result-banner--win`): `player_win`, `blackjack`, `dealer_bust` — any outcome where the player wins.
- **Red** (`result-banner--lose`): `dealer_win`, `player_bust` — any outcome where the dealer wins.
- **No banner for push** — push is deliberately not displayed visually (no popup).
- Animated: scales from 0.7 → 1.0 with a fade-in over 0.2s (`@keyframes result-pop`).

### Session W/L tracking
- **Win** incremented on: `player_win`, `blackjack`, `dealer_bust`
- **Loss** incremented on: `dealer_win`, `player_bust`
- **Push** is not counted in either column.
- Counts reset when the page is refreshed (session-scoped, not persisted to database).

---

## 9. Basic Strategy Evaluation

After every player action (hit, stand, double), `evaluateDecision()` in `game/basicStrategy.ts` checks whether the player chose correctly according to standard basic strategy.

### Strategy tables

Three lookup tables are encoded as constants:

- **`pair_splitting`** — keyed by pair type (e.g. `"A,A"`, `"8,8"`) and dealer upcard. Values: `Y` (split), `N` (don't split), `Y/N` (split if DAS offered).
- **`soft_totals`** — keyed by soft hand notation (e.g. `"A,7"`) and dealer upcard. Values: `H`, `S`, `D`, `Ds` (double or stand).
- **`hard_totals`** — keyed by hard total `"8"`–`"17"` and dealer upcard. Values: `H`, `S`, `D`.

Strategy codes:
| Code | Meaning |
|------|---------|
| `H` | Hit |
| `S` | Stand |
| `D` | Double; if double not available, Hit |
| `Ds` | Double; if double not available, Stand |
| `Y` | Split (pair) |
| `N` | Don't split — fall through to hard/soft table |
| `Y/N` | Split if DAS (Double After Split) offered |

### Lookup priority

1. If 2-card hand and it's a pair → look up `pair_splitting`
2. If soft hand → look up `soft_totals`
3. Otherwise → look up `hard_totals`
4. Hard total ≥ 17 → always Stand (not in table, handled by code)
5. Hard total ≤ 7 → always Hit (not in table, handled by code)

### Pair handling

When the recommended code is `Y`, `N`, or `Y/N`, split is not executable in the current game. The evaluator falls back to the hard/soft action for correctness checking. The displayed feedback notes the ideal split recommendation alongside the fallback.

### Decision feedback

After each player action, a feedback banner appears below the table on the floor:
- **Green** (`.decision-feedback--correct`): Player chose correctly.
- **Red** (`.decision-feedback--incorrect`): Player chose incorrectly, with the correct action stated.

Format: `✓ Correct — Stand` or `✗ Should Stand — you Hit`

The feedback persists until the next hand is dealt (it clears when `lastDecision` resets to `null`).

---

## 10. UI Layout

The game screen has two columns: the **game area** (left) and the **tutor panel** (right).

### Game area structure

The game area uses two distinct visual layers:

**Floor** (`.game-board`) — the dark green surround. `position: relative`. Contains absolutely-positioned corner elements:

```
┌─ floor ──────────────────────────────────────────┐
│ [HUD: top-left]                [W/L: top-right]  │
│                                                  │
│              ┌── table ──┐                       │
│              │  dealer   │                       │
│              │  ───────  │                       │
│              │  player   │                       │
│              └───────────┘                       │
│                                                  │
│ [Hit][Stand][Dbl][Split]          [Deal]         │
└──────────────────────────────────────────────────┘
```

**Table** (`.felt-table`) — the casino felt oval, centered on the floor. `position: relative`. Contains:
- Dealer card zone (top half)
- Divider line
- Player card zone (bottom half)
- Result banner overlay (centered, `position: absolute`)

### Corner element placement

| Corner | Content |
|--------|---------|
| Top-left | Probability / count HUD |
| Top-right | Session W/L record |
| Bottom-left | Hit, Stand, Double, Split buttons |
| Bottom-right | Deal button |

### Key size parameters (CSS variables / values)

| Property | Value |
|----------|-------|
| Card width | `5.5rem` (`--spacing-card-w`) |
| Card height | `7.5rem` (`--spacing-card-h`) |
| Table width | `min(48rem, 100%)` |
| Table aspect ratio | `4/3` |
| Tutor panel width | `28rem` |
| Floor padding | `5rem 2rem` (top/bottom clearance for corner elements) |

### Dealer hole card

The dealer's second card (index 1) is rendered face-down during `player` phase. It flips face-up when `phase === "result"` or `phase === "dealer"`. The dealer's total is only shown when the card is revealed.

---

## 11. HUD and Statistics

The top-left HUD (`.game-hud`) shows statistics that vary by level:

| Stat | Level shown | Notes |
|------|-------------|-------|
| Cards Left | All levels | Remaining cards in shoe |
| Running Count | Level 2+ | Hi-Lo running count; green if positive, red if negative, white if zero |
| True Count | Level 2+ | `round(runningCount / decksRemaining)`; same color coding; if < 0.5 decks remain, equals running count |

**Deliberately excluded:**
- Bust probability ("Bust if Hit") — removed. Will be re-introduced with explicit design instructions when the time comes.
- Bet sizing recommendations — not relevant to this educational tool.
- Dealer hole card probability — not shown.

---

## 12. Session Tracking

**W/L counter** (floor, top-right):
- Counts total hands won and lost within the current browser session.
- Resets on page refresh.
- Not persisted to the database (database schema exists for accuracy metrics but is not yet wired to in-game state).
- Push hands are excluded from both counts.
- Display: `W: {n} / L: {n}` with wins in green and losses in red.

---

## 13. Tutor Integration

### Architecture

The tutor is a side panel (`.tutor-panel`, 28rem wide) to the right of the game board. It is powered by a server-side API route (`/api/tutor`) that calls an LLM via a provider adapter (`lib/llm.ts`).

**Provider adapter** supports three backends, selected by `LLM_PROVIDER` in `.env.local`:
- `ollama` (default) — local Ollama via OpenAI-compatible API at `http://localhost:11434/v1`
- `litellm` — LiteLLM proxy
- `anthropic` — Anthropic cloud API

### Interaction model

**The tutor only responds to typed questions.** It does not fire automatically after player decisions.

Previous behavior (auto-feedback after every decision) was deliberately removed. Rationale: proactive tutor calls were disruptive to gameplay flow, and the inline decision feedback banner (`evaluateDecision`) already covers real-time correctness.

Players type questions into the input box at the bottom of the tutor panel. Each question is sent as an `"explain"` action to the API route, which calls `getTutorExplanation`. The conversation history is displayed in the panel but is **not** passed as context to subsequent LLM calls — each question is answered independently.

### System prompt for explanations

```
You are an expert Blackjack strategy tutor.
Role: Explain a Blackjack concept or strategy rule clearly.
Scope: Blackjack basic strategy, card counting, and probability only.
Format: 3-4 sentences, plain text, with a concrete example.
Constraint: Stay on topic — no general gambling advice.
```

### Unused LLM functions

`getTutorFeedback` and `getTutorHint` are implemented in `lib/llm.ts` and the API route handles `feedback` and `hint` actions, but nothing in the UI currently calls them. They are preserved for future use.

---

## 14. Deferred / Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Split | Button present, always disabled | Game logic not implemented; basic strategy encodes split recommendations but they are not executed |
| Bust probability display | Removed | Will be re-added with explicit design spec |
| Auto-tutor feedback | Removed | Was called after every decision; removed in favor of player-initiated questions only |
| Dealer animation | Not implemented | Dealer draws resolve instantly; no step-by-step reveal |
| Soft 17 rule | Implicitly stands | `calculateHandValue` resolves aces optimally so the dealer effectively stands on soft 17; this has not been explicitly configured |
| Session persistence | Not wired | `GameSession` and `UserProgress` tables exist in Supabase but game state is not saved between page loads |
| Accuracy metrics | Schema exists | `level_1_best_accuracy`, etc. in `UserProgress` are tracked in the DB schema but not yet written by the game |
| Multiple deck shoes | Initialized with 1 deck | `initShoe(numDecks)` supports N decks; all levels currently use 1 |
| Surrender | Not implemented | Not in the action set or strategy tables |
| Insurance | Not implemented | Not in the action set or strategy tables |
