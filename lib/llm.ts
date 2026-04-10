/**
 * LLM Provider Adapter
 *
 * All model/endpoint configuration lives in PROVIDERS below.
 * Set LLM_PROVIDER in .env.local to switch backends:
 *   ollama    → local Ollama via OpenAI-compatible /v1 endpoint
 *   litellm   → LiteLLM proxy (also OpenAI-compatible)
 *   anthropic → Anthropic cloud API
 */

import OpenAI from "openai";

// ─── Provider Configuration (edit here to change models) ────────────────────

const PROVIDERS = {
  ollama: {
    baseURL: `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/v1`,
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
    apiKey: "ollama", // required by SDK but ignored by Ollama
  },
  litellm: {
    baseURL: `${process.env.LITELLM_BASE_URL || "http://localhost:4000"}/v1`,
    model: process.env.LITELLM_MODEL || "ollama/gemma3:4b",
    apiKey: process.env.LITELLM_API_KEY || "sk-1234",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  },
} as const;

type Provider = keyof typeof PROVIDERS;
const ACTIVE_PROVIDER = (process.env.LLM_PROVIDER || "ollama") as Provider;

// ─── System Prompts ──────────────────────────────────────────────────────────

const TUTOR_FEEDBACK_SYSTEM = `You are an expert Blackjack strategy tutor.
Role: Give constructive feedback on the player's most recent decision.
Scope: Blackjack basic strategy and card counting only.
Format: 2-3 sentences, plain text, direct and encouraging.
Constraint: Never give away future answers directly — guide with reasoning.`;

const TUTOR_HINT_SYSTEM = `You are an expert Blackjack strategy tutor.
Role: Give a subtle hint to help the player decide their next move.
Scope: Blackjack basic strategy and card counting only.
Format: 1-2 sentences, plain text.
Constraint: Do not reveal the optimal play outright — prompt the player to reason.`;

const TUTOR_EXPLANATION_SYSTEM = `You are an expert Blackjack strategy tutor.
Role: Explain a Blackjack concept or strategy rule clearly.
Scope: Blackjack basic strategy, card counting, and probability only.
Format: 3-4 sentences, plain text, with a concrete example.
Constraint: Stay on topic — no general gambling advice.`;

// ─── Provider Implementations ────────────────────────────────────────────────

function makeOpenAIClient(provider: "ollama" | "litellm"): OpenAI {
  const config = PROVIDERS[provider];
  return new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
}

async function callOpenAICompatible(
  provider: "ollama" | "litellm",
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const client = makeOpenAIClient(provider);
  const model = PROVIDERS[provider].model;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return (completion.choices[0]?.message?.content || "").trim();
}

async function callAnthropic(prompt: string, systemPrompt: string): Promise<string> {
  const { apiKey, model } = PROVIDERS.anthropic;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${(err as { error?: { message?: string } }).error?.message || response.status}`);
  }

  const data = await response.json() as { content?: Array<{ text: string }> };
  return (data.content?.[0]?.text || "").trim();
}

// ─── Unified Dispatcher ──────────────────────────────────────────────────────

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  if (ACTIVE_PROVIDER === "anthropic") {
    return callAnthropic(prompt, systemPrompt);
  }
  return callOpenAICompatible(ACTIVE_PROVIDER, prompt, systemPrompt);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getTutorFeedback(gameContext: string): Promise<string> {
  try {
    return await callLLM(
      `Game state: ${gameContext}\n\nGive feedback on the player's most recent decision.`,
      TUTOR_FEEDBACK_SYSTEM
    );
  } catch (err) {
    console.error("getTutorFeedback failed:", err);
    return "Tutor unavailable. Try again.";
  }
}

export async function getTutorHint(gameContext: string): Promise<string> {
  try {
    return await callLLM(
      `Game state: ${gameContext}\n\nGive a hint to help the player decide their next move.`,
      TUTOR_HINT_SYSTEM
    );
  } catch (err) {
    console.error("getTutorHint failed:", err);
    return "Hint unavailable. Try again.";
  }
}

export async function getTutorExplanation(topic: string): Promise<string> {
  try {
    return await callLLM(`Explain: ${topic}`, TUTOR_EXPLANATION_SYSTEM);
  } catch (err) {
    console.error("getTutorExplanation failed:", err);
    return "Explanation unavailable. Try again.";
  }
}

export function getLLMConfig(): { provider: string; model: string; endpoint: string } {
  if (ACTIVE_PROVIDER === "anthropic") {
    return {
      provider: "anthropic",
      model: PROVIDERS.anthropic.model,
      endpoint: "https://api.anthropic.com",
    };
  }
  const config = PROVIDERS[ACTIVE_PROVIDER];
  return {
    provider: ACTIVE_PROVIDER,
    model: config.model,
    endpoint: config.baseURL,
  };
}
