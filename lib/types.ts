export type Level = 1 | 2 | 3 | 4;

export type LevelStatus = "locked" | "unlocked" | "completed";

export interface UserProgress {
  id: string;
  user_id: string;
  highest_level_completed: number;
  free_practice_unlocked: boolean;
  level_1_best_accuracy: number | null;
  level_2_best_accuracy: number | null;
  level_3_best_count_accuracy: number | null;
  level_3_best_decision_accuracy: number | null;
  level_4_sessions_completed: number;
  updated_at: string;
}

export interface GameSession {
  id: string;
  user_id: string;
  level: Level;
  game_state: Record<string, unknown>;
  conversation_history: Array<{ role: string; content: string }>;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}
