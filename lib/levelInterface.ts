import type React from "react";
import type { Level } from "@/lib/types";

export interface TutorPrompts {
  feedback: string;
  hint: string;
  explanation: string;
}

export interface LevelConfig {
  id: Level;
  title: string;
  description: string;
  passCriteria: string;
}

export interface LevelModule {
  config: LevelConfig;
  tutorPrompts: TutorPrompts;
  LevelSession: React.ComponentType<{ level: Level }>;
}
