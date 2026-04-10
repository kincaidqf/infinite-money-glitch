# LLM Integration Summary

## Architecture

The tutor uses a **provider adapter** pattern. All LLM calls go through `lib/llm.ts`, which dispatches to the active backend based on `LLM_PROVIDER` in `.env.local`.

```
GameSession (client)
  ├── GameBoard  →  onDecision(gameContext)  →  /api/tutor  →  lib/llm.ts  →  Ollama / LiteLLM / Anthropic
  └── TutorPanel →  onAsk(question)         →  /api/tutor  →  lib/llm.ts  →  ...
```

## Key Files

| File | Purpose |
|---|---|
| `lib/llm.ts` | Provider adapter — `PROVIDERS` config object, `callLLM()` dispatcher, public `getTutorFeedback/Hint/Explanation()` |
| `app/api/tutor/route.ts` | API route — validates action, calls lib/llm, returns JSON |
| `lib/useTutor.ts` | React hook — manages loading/error state for client components |
| `components/GameSession.tsx` | Client wrapper — connects GameBoard decisions to TutorPanel display |
| `components/TutorPanel.tsx` | Tutor UI — shows messages, handles manual questions |
| `components/GameBoard.tsx` | Game — emits `onDecision(gameContext)` after each player action |

## Changing the Local Model

Edit one line in `.env.local`:
```env
OLLAMA_MODEL=llama3.2:3b   # or any model from `ollama list`
```
Restart dev server. Nothing else changes.

## Switching Providers

Change one line in `.env.local`:
```env
LLM_PROVIDER=ollama     # local Ollama
LLM_PROVIDER=litellm    # LiteLLM proxy (100+ models)
LLM_PROVIDER=anthropic  # Anthropic cloud
```

## Why OpenAI SDK for local models

Both Ollama and LiteLLM expose an OpenAI-compatible `/v1/chat/completions` endpoint. Using the `openai` npm package as the client means:
- Typed request/response, proper error handling
- No custom fetch boilerplate
- LiteLLM proxy is a zero-code drop-in

Anthropic uses their own auth (`x-api-key` header), so it keeps a direct `fetch` implementation.

## Tutor Flow

1. Player makes a move in `GameBoard`
2. `evaluateDecision()` checks against basic strategy
3. `buildGameContext()` generates a plain-English summary
4. `GameSession.handleDecision()` debounces (1.5 s) then calls `/api/tutor?action=feedback`
5. Response appears in `TutorPanel`
6. Player can also type questions directly — those route to `action=explain`
