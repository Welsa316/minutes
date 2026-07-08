-- Let each roadmap choose what to call its groups — "Phase", "Week", "Milestone",
-- "Sprint"… — instead of a hardcoded "Phase 1 / Phase 2". Backfills existing
-- roadmaps to "Phase" (no visible change) and new ones default the same.
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS phase_noun TEXT NOT NULL DEFAULT 'Phase';
