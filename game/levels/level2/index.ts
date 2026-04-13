// ============================================================
// LEVEL 2 TEAM — This is your module entry point.
// Fill in gameLogic.ts, tutorPrompts.ts, and Level2Session.tsx.
// Do NOT modify any file outside game/levels/level2/ or
// components/levels/Level2Session.tsx.
// ============================================================

import type { LevelModule } from "@/lib/levelInterface";
import { tutorPrompts } from "@/game/levels/level2/tutorPrompts";
import Level2Session from "@/components/levels/Level2Session";

const level2Module: LevelModule = {
  config: {
    id: 2,
    title: "Hi-Lo Card Counting",
    description:
      "Learn to assign Hi-Lo values to every card and track the running count direction in real time.",
    passCriteria: "≥80% correct running count direction classifications across a full drill sequence",
  },
  tutorPrompts,
  LevelSession: Level2Session,
};

export default level2Module;
