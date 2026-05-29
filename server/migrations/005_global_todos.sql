-- Todos are app-global. Workspace assignment is purely a visual tag.
-- Drop NOT NULL so a todo can sit outside any workspace if the user prefers.
ALTER TABLE todos ALTER COLUMN workspace_id DROP NOT NULL;

-- Replace the partial index (which assumed a non-null workspace) with one
-- that handles both global and workspace-tagged todos efficiently.
DROP INDEX IF EXISTS idx_todos_workspace_alive;
CREATE INDEX idx_todos_alive       ON todos(done, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_todos_ws_alive    ON todos(workspace_id, done, due_date) WHERE deleted_at IS NULL AND workspace_id IS NOT NULL;

-- Workspaces shouldn't claim "todos" in their sections list anymore — the
-- sidebar will always show Todos regardless of the active workspace.
UPDATE workspaces SET sections = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements_text(sections)
  WHERE value != 'todos'
);
