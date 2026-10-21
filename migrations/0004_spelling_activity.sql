-- Spelling progress is separate from IELTS attempts and bands.
-- Immutable, account-scoped activity makes offline retries idempotent and
-- preserves the word bank even when old IELTS attempts are pruned.
CREATE TABLE IF NOT EXISTS spelling_activity (
 clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
 id TEXT NOT NULL,
 data TEXT NOT NULL,
 completed_at TEXT NOT NULL,
 PRIMARY KEY (clerk_user_id, id)
);
