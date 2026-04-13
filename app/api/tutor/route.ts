// SHARED — Do NOT modify this file for level-specific changes.
// To change tutor prompts for a level, edit:
//   game/levels/levelN/tutorPrompts.ts

import { getTutorFeedback, getTutorHint, getTutorExplanation } from "@/lib/llm";
import { LEVEL_REGISTRY } from "@/game/levels/registry";
import { NextRequest, NextResponse } from "next/server";
import type { Level } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { action, gameContext, topic, level } = await request.json();

    const now = Date.now();
    const lastCallTime = parseInt(request.headers.get("x-last-call") || "0", 10);
    if (now - lastCallTime < 1000) {
      return NextResponse.json(
        { error: "Rate limited. Wait 1 second between requests." },
        { status: 429 }
      );
    }

    const levelNum = Number(level) as Level;
    const levelModule = [1, 2, 3, 4].includes(levelNum)
      ? LEVEL_REGISTRY[levelNum]
      : null;
    const prompts = levelModule?.tutorPrompts ?? null;

    let response: string;

    switch (action) {
      case "feedback":
        if (!gameContext) {
          return NextResponse.json(
            { error: "Missing gameContext for feedback action" },
            { status: 400 }
          );
        }
        response = await getTutorFeedback(gameContext, prompts?.feedback ?? undefined);
        break;

      case "hint":
        if (!gameContext) {
          return NextResponse.json(
            { error: "Missing gameContext for hint action" },
            { status: 400 }
          );
        }
        response = await getTutorHint(gameContext, prompts?.hint ?? undefined);
        break;

      case "explain":
        if (!topic) {
          return NextResponse.json(
            { error: "Missing topic for explain action" },
            { status: 400 }
          );
        }
        response = await getTutorExplanation(topic, prompts?.explanation ?? undefined);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ response });
  } catch (err) {
    console.error("Tutor API error:", err);
    return NextResponse.json(
      { error: "Tutor service failed. Try again." },
      { status: 500 }
    );
  }
}
