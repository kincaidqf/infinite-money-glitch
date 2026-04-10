import { getTutorFeedback, getTutorHint, getTutorExplanation } from "@/lib/llm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { action, gameContext, topic } = await request.json();

    // Rate limiting: reject if called too frequently
    // (In production, use a real rate limiter like Redis)
    const now = Date.now();
    const lastCallTime = parseInt(request.headers.get("x-last-call") || "0", 10);
    if (now - lastCallTime < 1000) {
      return NextResponse.json(
        { error: "Rate limited. Wait 1 second between requests." },
        { status: 429 }
      );
    }

    let response: string;

    switch (action) {
      case "feedback":
        if (!gameContext) {
          return NextResponse.json(
            { error: "Missing gameContext for feedback action" },
            { status: 400 }
          );
        }
        response = await getTutorFeedback(gameContext);
        break;

      case "hint":
        if (!gameContext) {
          return NextResponse.json(
            { error: "Missing gameContext for hint action" },
            { status: 400 }
          );
        }
        response = await getTutorHint(gameContext);
        break;

      case "explain":
        if (!topic) {
          return NextResponse.json(
            { error: "Missing topic for explain action" },
            { status: 400 }
          );
        }
        response = await getTutorExplanation(topic);
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
