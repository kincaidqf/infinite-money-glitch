// ============================================================
// LEVEL 1 TEAM — This is your module entry point.
// Fill in gameLogic.ts, tutorPrompts.ts, and Level1Session.tsx.
// Do NOT modify any file outside game/levels/level1/ or
// components/levels/Level1Session.tsx.
// ============================================================

import type { LevelModule } from "@/lib/levelInterface";
import { tutorPrompts } from "@/game/levels/level1/tutorPrompts";
import Level1Session from "@/components/levels/Level1Session";

const level1Module: LevelModule = {
  config: {
    id: 1,
    title: "Probability Basics",
    description:
      "Learn why 31% of cards are worth 10 points and how that single probability shapes every hit/stand decision.",
    passCriteria: "5 consecutive correct probability-based hit/stand decisions in a row",
  },
  tutorPrompts,
  LevelSession: Level1Session,
};

export default level1Module;
