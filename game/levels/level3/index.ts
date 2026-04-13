// ============================================================
// LEVEL 3 TEAM — This is your module entry point.
// Fill in gameLogic.ts, tutorPrompts.ts, and Level3Session.tsx.
// Do NOT modify any file outside game/levels/level3/ or
// components/levels/Level3Session.tsx.
// ============================================================

import type { LevelModule } from "@/lib/levelInterface";
import { tutorPrompts } from "@/game/levels/level3/tutorPrompts";
import Level3Session from "@/components/levels/Level3Session";

const level3Module: LevelModule = {
  config: {
    id: 3,
    title: "Running Count & True Count",
    description:
      "Maintain count accuracy, calculate true count (RC ÷ decks remaining), and identify index play opportunities.",
    passCriteria:
      "≥75% count accuracy and ≥70% decision accuracy across a full simulated session",
  },
  tutorPrompts,
  LevelSession: Level3Session,
};

export default level3Module;
