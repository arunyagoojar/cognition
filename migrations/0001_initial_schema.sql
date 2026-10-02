-- Cognition user data schema
-- Clerk owns identity; D1 owns Cognition-specific user data.

CREATE TABLE IF NOT EXISTS users (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  target_band TEXT DEFAULT '7.0',
  theme TEXT DEFAULT 'light',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
  type TEXT NOT NULL,
  test_id TEXT,
  test_label TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  band REAL,
  data TEXT,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_type ON attempts(type);
CREATE INDEX IF NOT EXISTS idx_attempts_updated ON attempts(updated_at DESC);

CREATE TABLE IF NOT EXISTS completed_lessons (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
  lesson_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(clerk_user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_user ON completed_lessons(clerk_user_id);
