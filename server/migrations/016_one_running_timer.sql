-- Enforce "at most one running timer per workspace" at the DB level so two
-- concurrent Start requests can't leave duplicate open rows. Close any existing
-- duplicates first (keep the most recently started per workspace), then make the
-- partial running index unique.
UPDATE time_entries
SET ended_at = NOW(),
    minutes  = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))
WHERE ended_at IS NULL AND deleted_at IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON (workspace_id) id
    FROM time_entries
    WHERE ended_at IS NULL AND deleted_at IS NULL
    ORDER BY workspace_id, started_at DESC
  );

DROP INDEX IF EXISTS idx_time_running;
CREATE UNIQUE INDEX idx_time_running ON time_entries(workspace_id) WHERE ended_at IS NULL AND deleted_at IS NULL;
