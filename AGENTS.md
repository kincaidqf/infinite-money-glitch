<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Levels Architecture — File Ownership Rules

This project uses an isolated-directory architecture so four teams can develop levels 1–4 in parallel without merge conflicts. When working on a level, you must respect these boundaries.

## Which files belong to which team

| Team | Files they own — edit only these |
|------|----------------------------------|
| Level 1 | `game/levels/level1/gameLogic.ts`, `game/levels/level1/tutorPrompts.ts`, `game/levels/level1/index.ts`, `components/levels/Level1Session.tsx` |
| Level 2 | `game/levels/level2/gameLogic.ts`, `game/levels/level2/tutorPrompts.ts`, `game/levels/level2/index.ts`, `components/levels/Level2Session.tsx` |
| Level 3 | `game/levels/level3/gameLogic.ts`, `game/levels/level3/tutorPrompts.ts`, `game/levels/level3/index.ts`, `components/levels/Level3Session.tsx` |
| Level 4 | `game/levels/level4/gameLogic.ts`, `game/levels/level4/tutorPrompts.ts`, `game/levels/level4/index.ts`, `components/levels/Level4Session.tsx` |

## Files no level team should modify

These are shared infrastructure — changing them affects all levels and causes merge conflicts:

- `game/levels/registry.ts` — pre-wired registry
- `lib/levelInterface.ts` — TypeScript contract
- `lib/llm.ts` — LLM provider adapter
- `lib/types.ts` — shared types
- `app/game/[level]/page.tsx` — shared route
- `app/api/tutor/route.ts` — shared tutor API
- `game/basicStrategy.ts`, `game/cardUtils.ts`, `game/deckState.ts` — shared game utilities

If shared files need changes, open a PR to `main` separately and coordinate with all teams.

## What each level's index.ts must export

```typescript
// game/levels/levelN/index.ts
import type { LevelModule } from "@/lib/levelInterface";

const levelNModule: LevelModule = {
  config: { id, title, description, passCriteria },
  tutorPrompts: { feedback, hint, explanation },  // from tutorPrompts.ts
  LevelSession: LevelNSession,                    // from components/levels/LevelNSession.tsx
};
export default levelNModule;
```

## Branch workflow

Each team works on a dedicated branch (`level-1`, `level-2`, etc.) branched from `main` after the `levels` scaffolding branch is merged. PRs go from the level branch directly to `main`. Because files are disjoint, merges require no coordination.

## Tutor prompt rules

System prompts in `tutorPrompts.ts` must follow the four-part format from `CLAUDE.md`:
1. **Role** — what the tutor is
2. **Scope** — what topics are in/out of bounds for this level
3. **Format** — length, tone, plain text vs markdown
4. **Constraint** — what the tutor must never do

See `Blackjack_Tutor_SDD.md` for the authoritative scope definition per level (especially count disclosure rules — Level 1 must never mention counting).
