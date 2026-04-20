import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import LevelCard from "@/components/LevelCard";
import type { Level, LevelStatus, UserProgress } from "@/lib/types";

const LEVELS: Level[] = [1, 2, 3, 4];

function deriveLevelStatus(progress: UserProgress | null, level: Level): LevelStatus {
  const highest = progress?.highest_level_completed ?? 0;
  if (highest >= level) return "completed";
  if (highest >= level - 1) return "unlocked";
  return "locked";
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="home-page">
      <h1 className="home-page__title">Blackjack Counting Tutor</h1>
      <p className="home-page__subtitle">
        Master card counting through four progressive levels of interactive practice.
      </p>

      <div className="level-grid">
        {LEVELS.map((level) => (
          <LevelCard
            key={level}
            level={level}
            status={deriveLevelStatus(progress ?? null, level)}
          />
        ))}
      </div>

      <section className="about-section">
        <h2 className="about-section__heading">About</h2>
        <p className="about-section__body">
          This app teaches blackjack card counting through scaffolded instruction. Starting
          with basic strategy and probability, you&apos;ll progressively learn the Hi-Lo counting
          system, true count calculation, and finally advanced bet-sizing techniques. An
          AI-powered tutor provides immediate, contextual feedback on every decision.
        </p>
        <p className="about-section__body" style={{ marginTop: "0.75rem" }}>
          New to blackjack?{" "}
          <a
            href="https://www.playusa.com/blackjack/rules/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-chip-gold)", textDecoration: "underline" }}
          >
            Read the basic rules here.
          </a>
        </p>
      </section>
    </main>
  );
}
