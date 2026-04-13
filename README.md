# Infinite Money Glitch — Blackjack Card Counting Tutor

An educational web app that teaches blackjack basic strategy and Hi-Lo card counting through interactive gameplay and an LLM-powered tutor.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** — auth (email/password) + PostgreSQL progress tracking
- **LLM** — local Ollama by default; switch to Anthropic Claude via `.env.local`
- **Tailwind CSS v4** for layout; custom CSS properties for game theme

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You must create a Supabase project and run `supabase/schema.sql` before auth and progress tracking work.

For LLM setup see `OLLAMA_SETUP.md`.

---

## Levels Architecture

The game has four progressive levels defined in `Blackjack_Tutor_SDD.md`. Each level is isolated in its own directory so teams can develop in parallel without merge conflicts.

### How it works

A central registry (`game/levels/registry.ts`) maps level numbers to their module. The shared page (`app/game/[level]/page.tsx`) and tutor API (`app/api/tutor/route.ts`) delegate to the correct level module automatically — **these shared files never need to be edited by level teams**.

```
game/levels/
├── registry.ts          ← SHARED, do not edit
├── level1/
│   ├── index.ts         ← Level 1 team owns everything in this folder
│   ├── gameLogic.ts
│   └── tutorPrompts.ts
├── level2/  ...         ← Level 2 team
├── level3/  ...         ← Level 3 team
└── level4/  ...         ← Level 4 team

components/levels/
├── Level1Session.tsx    ← Level 1 team owns this file
├── Level2Session.tsx    ← Level 2 team
├── Level3Session.tsx    ← Level 3 team
└── Level4Session.tsx    ← Level 4 team

lib/levelInterface.ts    ← SHARED contract, do not edit
```

### Team file ownership

| Team | Owns these files — touch nothing else |
|------|---------------------------------------|
| Level 1 | `game/levels/level1/**` + `components/levels/Level1Session.tsx` |
| Level 2 | `game/levels/level2/**` + `components/levels/Level2Session.tsx` |
| Level 3 | `game/levels/level3/**` + `components/levels/Level3Session.tsx` |
| Level 4 | `game/levels/level4/**` + `components/levels/Level4Session.tsx` |

### Branch workflow

```
main  (has scaffolding after levels branch is merged)
├── level-1  →  PR → main
├── level-2  →  PR → main
├── level-3  →  PR → main
└── level-4  →  PR → main
```

Each team branches off `main`, works only in their owned files, and opens a PR. Because the files are disjoint, PRs merge cleanly with no conflicts.

### What each level module must export

Each `game/levels/levelN/index.ts` must export a default `LevelModule` (see `lib/levelInterface.ts`):

```typescript
{
  config: {
    id: Level;           // 1 | 2 | 3 | 4
    title: string;
    description: string;
    passCriteria: string;
  };
  tutorPrompts: {
    feedback: string;    // system prompt for post-decision feedback
    hint: string;        // system prompt for hints
    explanation: string; // system prompt for concept explanations
  };
  LevelSession: React.ComponentType<{ level: Level }>;
}
```

### Shared utilities available to all levels

```typescript
import { calculateHandValue, isSoft, isBust } from "@/game/cardUtils";
import { getBasicStrategyAction, evaluateDecision } from "@/game/basicStrategy";
import { initShoe, dealCard, getTrueCount, getProbabilities } from "@/game/deckState";
import type { Card } from "@/lib/cards";
```

---

## Level Summary

| Level | Topic | Pass Criteria |
|-------|-------|---------------|
| 1 | Basic Strategy | ≥70% correct decisions across a full shoe |
| 2 | Hi-Lo Classification | ≥80% correct count direction across a drill sequence |
| 3 | Running Count & True Count | ≥75% count accuracy + ≥70% decision accuracy |
| 4 | Bet Sizing & Bankroll Management | Complete a full session (participation-based) |

See `Blackjack_Tutor_SDD.md` for the full specification of each level.

---

## Project Structure

```
app/
  game/[level]/page.tsx   # shared route — delegates to registry
  api/tutor/route.ts      # shared tutor API — uses level-specific prompts
  api/progress/route.ts   # progress read/write
  login/page.tsx
  page.tsx                # level select screen
components/
  levels/                 # one component per level (team-owned)
  GameBoard.tsx           # shared card display
  GameHeader.tsx          # shared header
  TutorPanel.tsx          # shared tutor chat panel
  LevelCard.tsx           # level select card
game/
  levels/                 # level modules (team-owned) + registry
  basicStrategy.ts        # Basic Strategy lookup tables
  cardUtils.ts            # hand value, soft/hard detection
  deckState.ts            # shoe management, counts, probabilities
lib/
  levelInterface.ts       # LevelModule TypeScript contract
  llm.ts                  # LLM provider adapter (Ollama / Anthropic)
  types.ts                # shared TypeScript types
  useTutor.ts             # React hook for tutor API calls
  supabase/               # browser + server Supabase clients
supabase/
  schema.sql              # run in Supabase SQL editor to init tables
```
