-- Soft delete: keep rows around for ~30 days after "delete" so they can be
-- restored. Trash views filter WHERE deleted_at IS NOT NULL.
ALTER TABLE clients      ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE projects     ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE meetings     ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE notes        ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE action_items ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_clients_alive      ON clients(id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_alive     ON projects(id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_alive     ON meetings(id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_alive        ON notes(id)        WHERE deleted_at IS NULL;
CREATE INDEX idx_action_items_alive ON action_items(id) WHERE deleted_at IS NULL;
