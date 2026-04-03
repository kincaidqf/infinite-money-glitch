-- Blackjack Counting Tutor — Supabase Schema
-- Run this in the Supabase SQL editor.

-- progress table
CREATE TABLE IF NOT EXISTS progress (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  highest_level_completed     INTEGER NOT NULL DEFAULT 0 CHECK (highest_level_completed BETWEEN 0 AND 4),
  free_practice_unlocked      BOOLEAN NOT NULL DEFAULT false,
  level_1_best_accuracy       REAL,
  level_2_best_accuracy       REAL,
  level_3_best_count_accuracy REAL,
  level_3_best_decision_accuracy REAL,
  level_4_sessions_completed  INTEGER NOT NULL DEFAULT 0,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level                INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  game_state           JSONB NOT NULL DEFAULT '{}',
  conversation_history JSONB NOT NULL DEFAULT '[]',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at             TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own rows
CREATE POLICY "Users can access own progress"
  ON progress FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can access own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);
