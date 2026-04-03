import Link from "next/link";
import type { Level, LevelStatus } from "@/lib/types";

const LEVEL_META: Record<Level, { title: string; description: string }> = {
  1: {
    title: "Basic Strategy",
    description: "Learn blackjack probability and optimal play decisions.",
  },
  2: {
    title: "Hi-Lo Counting",
    description: "Classify cards and track the running count direction.",
  },
  3: {
    title: "True Count",
    description: "Maintain an accurate running count through a full shoe.",
  },
  4: {
    title: "Bet Sizing",
    description: "Apply the Kelly Criterion and manage your bankroll.",
  },
};

interface LevelCardProps {
  level: Level;
  status: LevelStatus;
}

export default function LevelCard({ level, status }: LevelCardProps) {
  const { title, description } = LEVEL_META[level];
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  const cardContent = (
    <div className={`level-card level-card--${status}`}>
      <div className="level-card__header">
        <span className="level-card__number">Level {level}</span>
        {isCompleted && <span className="level-card__badge level-card__badge--done">✓</span>}
        {isLocked && <span className="level-card__badge level-card__badge--lock">🔒</span>}
      </div>
      <h2 className="level-card__title">{title}</h2>
      <p className="level-card__desc">{description}</p>
    </div>
  );

  if (isLocked) {
    return <div aria-disabled="true">{cardContent}</div>;
  }

  return <Link href={`/game/${level}`}>{cardContent}</Link>;
}
