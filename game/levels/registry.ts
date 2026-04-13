// ============================================================
// SHARED — Do NOT modify this file.
// This registry is pre-wired. Level teams only edit their own
// folder: game/levels/levelN/ and components/levels/LevelNSession.tsx
// ============================================================

import type { Level } from "@/lib/types";
import type { LevelModule } from "@/lib/levelInterface";
import level1Module from "@/game/levels/level1/index";
import level2Module from "@/game/levels/level2/index";
import level3Module from "@/game/levels/level3/index";
import level4Module from "@/game/levels/level4/index";

export const LEVEL_REGISTRY: Record<Level, LevelModule> = {
  1: level1Module,
  2: level2Module,
  3: level3Module,
  4: level4Module,
};
