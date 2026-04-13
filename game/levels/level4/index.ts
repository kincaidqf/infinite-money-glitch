// ============================================================
// LEVEL 4 TEAM — This is your module entry point.
// Fill in gameLogic.ts, tutorPrompts.ts, and Level4Session.tsx.
// Do NOT modify any file outside game/levels/level4/ or
// components/levels/Level4Session.tsx.
// ============================================================

import type { LevelModule } from "@/lib/levelInterface";
import { tutorPrompts } from "@/game/levels/level4/tutorPrompts";
import Level4Session from "@/components/levels/Level4Session";

const level4Module: LevelModule = {
  config: {
    id: 4,
    title: "Bet Sizing & Bankroll Management",
    description:
      "Apply all prior skills plus Kelly Criterion bet sizing and bankroll management to play with a full edge.",
    passCriteria: "Complete a full multi-hand session with count, decision, and bet-sizing evaluated",
  },
  tutorPrompts,
  LevelSession: Level4Session,
};

export default level4Module;
