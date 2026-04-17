import type { LevelModule } from "@/lib/levelInterface";
import { tutorPrompts } from "@/game/levels/level2/tutorPrompts";
import Level2Session from "@/components/levels/Level2Session";

const level2Module: LevelModule = {
  config: {
    id: 2,
    title: "Running Count Direction",
    description:
      "Discover how tracking dealt cards reveals whether the remaining shoe holds more or fewer 10-value cards than a fresh deck — shifting the probabilities you learned in Level 1.",
    passCriteria: "5 consecutive correct count-direction inputs in Stage 4",
  },
  tutorPrompts,
  LevelSession: Level2Session,
};

export default level2Module;
