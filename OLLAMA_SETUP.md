# LLM Setup Guide

The tutor uses a provider adapter in `lib/llm.ts` that routes to any OpenAI-compatible backend.
**All model and endpoint config lives in `.env.local`** — no other file needs editing to switch models.

## Supported Providers

| `LLM_PROVIDER` | Description |
|---|---|
| `ollama` | Local Ollama (default) — uses `/v1/chat/completions` endpoint |
| `litellm` | LiteLLM proxy — run locally to access any model via a unified API |
| `anthropic` | Anthropic cloud API |

---

## Option 1: Ollama (default)

### Setup

1. Install Ollama from [ollama.com](https://ollama.com) and run:
   ```bash
   ollama serve
   ```

2. Pull a model:
   ```bash
   ollama pull gemma3:4b      # default
   ollama pull llama3.2:3b    # fast alternative
   ollama pull mistral        # good general purpose
   ```

3. To switch models, update one line in `.env.local`:
   ```env
   OLLAMA_MODEL=llama3.2:3b
   ```

4. Restart the dev server: `npm run dev`

### Verify

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:4b","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Option 2: LiteLLM Proxy

LiteLLM lets you use 100+ models (Ollama, OpenAI, Mistral, Groq, etc.) behind a single OpenAI-compatible endpoint. Swap models without touching any app code.

### Setup

```bash
pip install litellm
```

Start the proxy pointing at your local Ollama model:
```bash
litellm --model ollama/gemma3:4b --port 4000
```

Or use a cloud model:
```bash
export OPENAI_API_KEY=sk-...
litellm --model gpt-4o --port 4000
```

Update `.env.local`:
```env
LLM_PROVIDER=litellm
LITELLM_BASE_URL=http://localhost:4000
LITELLM_MODEL=ollama/gemma3:4b
```

Restart `npm run dev`.

### Switching models with LiteLLM

Only the `litellm` command and `LITELLM_MODEL` in `.env.local` need to change — the app code is untouched.

---

## Option 3: Anthropic (cloud)

1. Get a key from [console.anthropic.com](https://console.anthropic.com)

2. Update `.env.local`:
   ```env
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

3. Restart `npm run dev`

---

## Testing the API

```bash
# Feedback on a decision
curl -X POST http://localhost:3000/api/tutor \
  -H "Content-Type: application/json" \
  -d '{"action":"feedback","gameContext":"Player has 16 (10+6), dealer showing 9, player hit and busted"}'

# Hint before a decision
curl -X POST http://localhost:3000/api/tutor \
  -H "Content-Type: application/json" \
  -d '{"action":"hint","gameContext":"Player has 11 (5+6), dealer showing 6"}'

# Explain a concept
curl -X POST http://localhost:3000/api/tutor \
  -H "Content-Type: application/json" \
  -d '{"action":"explain","topic":"When should I double down?"}'
```

---

## Troubleshooting

**Connection refused / ECONNREFUSED**
- Ollama: confirm `ollama serve` is running
- LiteLLM: confirm `litellm --model ... --port 4000` is running

**Model not found**
- Run `ollama list` to see available models
- Pull it: `ollama pull <model-name>`

**Slow responses**
- Try a smaller model: `ollama pull llama3.2:1b`
- Or use LiteLLM with a cloud model for better speed

**API key errors (Anthropic)**
- Ensure `ANTHROPIC_API_KEY` is set and `LLM_PROVIDER=anthropic`
- Restart dev server after changing env vars
