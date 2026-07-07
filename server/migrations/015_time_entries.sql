-- Time tracking: the money-funnel keystone. A time entry is a span of work,
-- optionally tagged to a client and/or project. A running timer is a row with
-- ended_at IS NULL; stopping it fills ended_at + minutes. rate_cents is reserved
-- for the future Invoicing module (billable value = minutes/60 * rate).

CREATE TABLE time_entries (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  note         TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  minutes      INTEGER,                         -- NULL while a timer is running
  billable     BOOLEAN NOT NULL DEFAULT TRUE,
  rate_cents   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_time_workspace ON time_entries(workspace_id) WHERE deleted_at IS NULL;
-- At most one running timer matters per workspace; this makes the lookup cheap.
CREATE INDEX idx_time_running ON time_entries(workspace_id) WHERE ended_at IS NULL AND deleted_at IS NULL;

-- Turn Time on by default for the Freelance workspace (billable hours live there).
UPDATE workspaces
SET sections = (
  SELECT jsonb_agg(DISTINCT val)
  FROM jsonb_array_elements(COALESCE(sections, '[]'::jsonb) || '["time"]'::jsonb) AS val
)
WHERE slug = 'freelance';
