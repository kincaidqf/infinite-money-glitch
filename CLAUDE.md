# CLAUDE.md — Project Rules & Architecture

## Mission
Build a working demo of an educational website with:
1. **Interactive visual game component** — user engages with a subject through gameplay
2. **LLM-powered text tutoring** — Claude API provides feedback, hints, and explanations

Priority order: **working > clean > scalable**. Ship a demo first. Abstract later.

---

## Stack

### Demo Phase (local-first)
| Layer | Choice | Upgrade Path |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS or React (single file or Vite) | Next.js |
| LLM API | Local Ollama (development-first; run `ollama` locally) — easily switchable to cloud LLMs such as Anthropic Claude | Use local Ollama for demo; cloud LLM (Anthropic) as upgrade |
| Backend | None (direct browser → Anthropic API) | Node/Express or Next.js API routes |
| Auth | None | Clerk or NextAuth |
| DB | None / localStorage | Supabase or PlanetScale |
| Hosting | Local (`localhost`) | Vercel or Netlify |

**Do not add infrastructure that isn't needed for the demo.**

---

## File Structure

```
app/
  game/[level]/page.tsx     # Shared route — reads level, delegates to registry. DO NOT EDIT per-level.
  api/tutor/route.ts        # Shared tutor API — routes to level-specific prompts. DO NOT EDIT per-level.
  api/progress/route.ts     # User progress read/write
  login/page.tsx            # Auth screen
  page.tsx                  # Level select screen
  globals.css               # Global styles + CSS custom properties
components/
  levels/                   # One component per level — each is team-owned
    Level1Session.tsx       # ← Level 1 team owns this
    Level2Session.tsx       # ← Level 2 team
    Level3Session.tsx       # ← Level 3 team
    Level4Session.tsx       # ← Level 4 team
  GameBoard.tsx             # Shared card display
  GameHeader.tsx            # Shared header bar
  TutorPanel.tsx            # Shared tutor chat panel
  LevelCard.tsx             # Level select card
game/
  levels/
    registry.ts             # SHARED — pre-wired, no team edits this
    level1/                 # ← Level 1 team owns this directory
      index.ts              #   LevelModule default export
      gameLogic.ts          #   Pure state functions
      tutorPrompts.ts       #   System prompts for feedback/hint/explanation
    level2/  ...            # ← Level 2 team
    level3/  ...            # ← Level 3 team
    level4/  ...            # ← Level 4 team
  basicStrategy.ts          # Shared: Basic Strategy lookup + evaluateDecision
  cardUtils.ts              # Shared: calculateHandValue, isSoft, isBust
  deckState.ts              # Shared: shoe init, dealCard, getTrueCount, getProbabilities
lib/
  levelInterface.ts         # SHARED contract — LevelModule, TutorPrompts, LevelConfig
  llm.ts                    # LLM provider adapter (Ollama / LiteLLM / Anthropic)
  types.ts                  # Shared TypeScript types
  useTutor.ts               # React hook for tutor API calls
  supabase/                 # Browser + server Supabase clients
supabase/
  schema.sql                # Run in Supabase SQL editor to init tables + RLS
```

### Levels architecture rule

Each level lives in its own isolated directory. Teams work in parallel by owning disjoint files:

| Team | Files they own |
|------|---------------|
| Level 1 | `game/levels/level1/**` + `components/levels/Level1Session.tsx` |
| Level 2 | `game/levels/level2/**` + `components/levels/Level2Session.tsx` |
| Level 3 | `game/levels/level3/**` + `components/levels/Level3Session.tsx` |
| Level 4 | `game/levels/level4/**` + `components/levels/Level4Session.tsx` |

The registry (`game/levels/registry.ts`), shared page, and tutor API are pre-wired — **level teams must not modify them**. This guarantees zero merge conflicts across level branches.

---

## Code Standards

### General
- **No dead code.** Remove commented-out blocks before committing.
- **No TODOs in committed code.** Either fix it or open a tracked issue.
- **Functions do one thing.** If a function name needs "and", split it.
- Max function length: **40 lines**. Break into helpers if longer.
- Max file length: **200 lines**. Split by concern if longer.

### Naming
- Variables and functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`
- Files: `camelCase.js` or `PascalCase.jsx` for components

### Error Handling
- **All API calls must have try/catch.** Never let a failed LLM call crash the UI.
- Display user-facing errors in plain English inside the UI, not the console alone.
- Log errors to console in dev; silence non-critical logs in prod.

---

## LLM Integration Rules (`tutor/llm.js`)

### API Call Template
```js
async function getTutorFeedback(context) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  } catch (err) {
    console.error("LLM call failed:", err);
    return "Tutor unavailable. Try again.";
  }
}
```

### Rules
- **One function per LLM use case** (feedback, hint, explanation, etc.)
- All system prompts are **named constants** at the top of `llm.js` — never inline strings.
- Prompts must be **instructional, specific, and concise**. No filler.
- Include game state in every LLM call so responses are contextual.
- **Never send PII or sensitive user data** to the API.
- Rate-limit guard: debounce LLM calls by at minimum **1 second**.

- **Local-first LLM (Ollama):** During demo development prefer a local Ollama instance for LLM calls (easier offline development, lower latency, and no remote API keys). Implement `tutor/llm.js` as a small provider adapter that routes to the active backend based on an environment flag (for example `LLM_PROVIDER=ollama|anthropic`). Keep provider-specific code isolated behind this adapter so switching to a cloud API is a single config change.

- **Provider adapter guidance:** `tutor/llm.js` should export unified functions (e.g. `getTutorFeedback`, `getHint`, `getExplanation`) that internally call `ollama` when `LLM_PROVIDER=ollama` and call Anthropic-compatible functions when `LLM_PROVIDER=anthropic`. All calls must preserve the same `context` input shape and the same error-handling surface (try/catch, friendly messages).

### Prompt Design
Every system prompt must specify:
1. Role: what the tutor is
2. Scope: what subject/game it covers
3. Format: how to structure the response (length, tone, markdown or plain text)
4. Constraint: what NOT to do (no off-topic answers, no giving away answers directly)

When implementation or design choices are unclear (format details, tutoring policy, or game-specific constraints), consult `Blackjack_Tutor_SDD.md` for the authoritative specification and examples to guide development decisions.

---

## Game Component Rules (`game/`)

- **Game logic is pure.** `game/levels/levelN/gameLogic.ts` exports functions that take state and return new state. No DOM manipulation, no React imports.
- **Renderer is separate.** `components/levels/LevelNSession.tsx` reads state and updates the UI.
- Game state is a **single plain object** per level — serialize it easily with `JSON.stringify`.
- Each level's `gameLogic.ts` must export a `getLevelNGameContext(state)` function that returns a plain-English summary of current game state for LLM calls.
- The `LevelModule` contract (`lib/levelInterface.ts`) is the authoritative interface. Every level must satisfy it.

---

## Environment & Secrets

- API keys go in `.env.local` — add to `.gitignore` immediately.
- Access via `process.env.ANTHROPIC_API_KEY` (or a config module).
- **Demo phase only:** key may be hardcoded in a local-only config file that is gitignored. Remove before any public deployment.
- If shipping to Vercel/Netlify, use their environment variable UI — never commit keys.

---

## CSS Rules

- Use **CSS custom properties** for all colors, spacing, and font sizes.
- Mobile-first: base styles apply at mobile width; add `min-width` breakpoints above.
- No CSS frameworks unless explicitly approved. Write what you need.
- Game canvas/board: use fixed aspect ratio with `aspect-ratio` CSS or JS resize handler.

---

## Testing (Demo Phase)

No automated tests required for the demo. Manual QA checklist before each session:

- [ ] Game loads and is playable without errors
- [ ] LLM tutor responds to at least one game event
- [ ] API errors display gracefully in the UI
- [ ] No API key visible in the browser network tab or source
- [ ] Works on latest Chrome (primary) and Safari (secondary)

---

## Commit Rules

- Commits are in present tense: `Add game state serializer`, not `Added...`
- Never commit: `.env`, API keys, `node_modules`, build artifacts
- One concern per commit. Don't bundle unrelated changes.

---

## Scaling Checklist (When Ready)

Do these in order, only when the demo is stable:

1. Move API calls to a backend route (Next.js or Express) to hide the API key
2. Add streaming (`stream: true`) for real-time tutor responses
3. Add `localStorage` persistence for game progress
4. Add a database (Supabase) for user accounts and progress tracking
5. Add auth (Clerk) before any user data is stored
6. Add automated tests for game logic (Vitest)
7. Deploy to Vercel with environment variables configured

---

## What Claude Should NOT Do

- Do not add dependencies without a clear reason.
- Do not abstract prematurely — no generic utilities until a pattern repeats 3+ times.
- Do not write placeholder or lorem ipsum content in committed code.
- Do not make UI decisions without checking this file's stack constraints first.
- Do not use `any` types if TypeScript is adopted later.
- Do not hallucinate package names — verify a package exists before importing it.
