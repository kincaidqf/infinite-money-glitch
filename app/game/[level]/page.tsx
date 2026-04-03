import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import GameHeader from "@/components/GameHeader";
import GameBoard from "@/components/GameBoard";
import TutorPanel from "@/components/TutorPanel";
import type { Level, LevelStatus, UserProgress } from "@/lib/types";

function deriveLevelStatus(progress: UserProgress | null, level: Level): LevelStatus {
  const highest = progress?.highest_level_completed ?? 0;
  if (highest >= level) return "completed";
  if (highest >= level - 1) return "unlocked";
  return "locked";
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level: levelParam } = await params;
  const levelNum = parseInt(levelParam, 10);

  if (![1, 2, 3, 4].includes(levelNum)) {
    redirect("/");
  }

  const level = levelNum as Level;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const status = deriveLevelStatus(progress ?? null, level);
  if (status === "locked") redirect("/");

  return (
    <div className="game-page">
      <GameHeader level={level} />
      <div className="game-layout">
        <GameBoard level={level} />
        <TutorPanel />
      </div>
    </div>
  );
}
