-- Workspaces: top-level grouping for everything in the app.
-- Sections is a JSONB array of section keys this workspace exposes in its nav.
CREATE TABLE workspaces (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  icon        TEXT,                    -- short string / emoji shown in switcher
  color       TEXT,                    -- hex without # — used for the sidebar accent
  sections    JSONB NOT NULL DEFAULT '["clients","projects","meetings","notes","tags","todos"]'::jsonb,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the two workspaces from the user's request.
INSERT INTO workspaces (slug, name, icon, color, sections, sort_order) VALUES
  ('freelance', 'Freelance', 'F', 'C65D3E',
    '["clients","projects","meetings","notes","tags","todos"]'::jsonb, 0),
  ('servlyy',   'Servlyy',   'S', '3F6B4C',
    '["notes","todos"]'::jsonb, 1);

-- Add workspace_id to every entity; backfill to Freelance; lock NOT NULL.
ALTER TABLE clients      ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE projects     ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE meetings     ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE notes        ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tags         ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE pinned       ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE saved_views  ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE clients      SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE projects     SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE meetings     SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE notes        SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE tags         SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE pinned       SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;
UPDATE saved_views  SET workspace_id = (SELECT id FROM workspaces WHERE slug='freelance') WHERE workspace_id IS NULL;

ALTER TABLE clients      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE projects     ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE meetings     ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE notes        ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE tags         ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE pinned       ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE saved_views  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX idx_clients_workspace      ON clients(workspace_id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_workspace     ON projects(workspace_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_workspace     ON meetings(workspace_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_workspace        ON notes(workspace_id)        WHERE deleted_at IS NULL;
CREATE INDEX idx_tags_workspace         ON tags(workspace_id);
CREATE INDEX idx_pinned_workspace       ON pinned(workspace_id);
CREATE INDEX idx_saved_views_workspace  ON saved_views(workspace_id);

-- Tag name is now unique per workspace, not globally.
ALTER TABLE tags DROP CONSTRAINT tags_name_key;
ALTER TABLE tags ADD CONSTRAINT tags_workspace_name_key UNIQUE (workspace_id, name);

-- Standalone todos (independent of meeting action_items).
CREATE TABLE todos (
  id            SERIAL PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  due_date      DATE,
  priority      TEXT CHECK (priority IS NULL OR priority IN ('low','med','high')),
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_todos_workspace_alive ON todos(workspace_id, done, due_date) WHERE deleted_at IS NULL;
