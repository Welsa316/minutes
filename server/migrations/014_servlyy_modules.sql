-- Servlyy founder pipeline: product Feedback → Roadmap ideas → KPI Metrics.
-- All three are workspace-scoped opt-in modules with soft-delete, following the
-- established table shape. ideas is created first so feedback can FK to it.

CREATE TABLE ideas (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  note         TEXT,
  lane         TEXT NOT NULL DEFAULT 'considering'
               CHECK (lane IN ('someday', 'considering', 'next', 'building', 'shipped')),
  effort       TEXT CHECK (effort IN ('s', 'm', 'l')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_ideas_workspace ON ideas(workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE feedback (
  id                  SERIAL PRIMARY KEY,
  workspace_id        INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  detail              TEXT,
  source              TEXT NOT NULL DEFAULT 'other'
                      CHECK (source IN ('email', 'dm', 'support', 'inapp', 'other')),
  requester_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'triaged', 'planned', 'shipped', 'declined')),
  idea_id             INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_feedback_workspace ON feedback(workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE metric_snapshots (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric       TEXT NOT NULL,
  value_num    NUMERIC NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'count' CHECK (unit IN ('count', 'currency', 'percent')),
  period       DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (workspace_id, metric, period)
);
CREATE INDEX idx_metric_workspace ON metric_snapshots(workspace_id) WHERE deleted_at IS NULL;

-- Turn the three new modules on for the Servlyy workspace by default (deduped),
-- since that's the founder surface they serve. Other workspaces opt in manually.
UPDATE workspaces
SET sections = (
  SELECT jsonb_agg(DISTINCT val)
  FROM jsonb_array_elements(COALESCE(sections, '[]'::jsonb) || '["feedback","roadmap","metrics"]'::jsonb) AS val
)
WHERE slug = 'servlyy';
