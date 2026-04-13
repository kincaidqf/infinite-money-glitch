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
    title: "Basic Strategy",
    description:
      "Master optimal hit/stand/double decisions based on your hand total and the dealer upcard.",
    passCriteria: "≥70% correct Basic Strategy decisions across a full simulated shoe",
  },
  tutorPrompts,
  LevelSession: Level1Session,
};

export default level1Module;
