-- Onboarding completion is persisted per account (not per device), so a user
-- sees onboarding exactly once — after their first successful sign-in — no
-- matter which browser/device they use afterwards.
--
-- NULL  = onboarding not yet completed/skipped.
-- Every account that exists when this migration runs is treated as already
-- onboarded, so existing users never see it unexpectedly.

ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;

UPDATE users SET onboarding_completed_at = COALESCE(created_at, datetime('now'))
WHERE onboarding_completed_at IS NULL;
