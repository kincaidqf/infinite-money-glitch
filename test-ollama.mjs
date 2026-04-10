#!/usr/bin/env node
/**
 * Quick test script to verify Ollama and tutor setup
 * Run with: node test-ollama.mjs
 */

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma2:2b";

async function testOllamaConnection() {
  console.log(`🔍 Testing Ollama connection to ${OLLAMA_URL}...`);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log("✅ Ollama server is running");
    console.log(`   Available models: ${data.models?.map(m => m.name).join(", ") || "none"}`);
    return true;
  } catch (err) {
    console.error("❌ Cannot connect to Ollama");
    console.error(`   Error: ${err instanceof Error ? err.message : err}`);
    console.error(`   Make sure Ollama is running: ollama serve`);
    return false;
  }
}

async function testOllamaGenerate() {
  console.log(`\n🤖 Testing model generation with ${OLLAMA_MODEL}...`);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: "What is 2+2?",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.response) {
      console.log("✅ Model responded successfully");
      console.log(`   Response: ${data.response.trim().substring(0, 100)}...`);
      return true;
    } else {
      throw new Error("No response from model");
    }
  } catch (err) {
    console.error("❌ Model generation failed");
    console.error(`   Error: ${err instanceof Error ? err.message : err}`);
    console.error(`   Make sure the model is pulled: ollama pull ${OLLAMA_MODEL}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Ollama & Tutor Setup Test\n");

  const serverOk = await testOllamaConnection();
  if (!serverOk) {
    console.log("\n⚠️  Cannot proceed without Ollama server");
    process.exit(1);
  }

  const modelOk = await testOllamaGenerate();
  if (!modelOk) {
    process.exit(1);
  }

  console.log("\n✨ All checks passed! Ollama is ready.");
  console.log("   Start the dev server: npm run dev");
}

main().catch(console.error);
