-- Notes redesign: track last-edited time (for "edited 3m ago" + the Edited sort)
-- and give each note an optional emoji icon + a warm cover token.
ALTER TABLE notes ADD COLUMN updated_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN icon TEXT;
ALTER TABLE notes ADD COLUMN cover TEXT;

-- Backfill existing notes so sorting/relative-time have a value from day one.
UPDATE notes SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE notes ALTER COLUMN updated_at SET DEFAULT NOW();
