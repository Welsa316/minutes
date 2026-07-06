-- Multi-user foundation. Workspaces belong to a user; everything else is
-- already scoped through its workspace, so ownership flows through. The two
-- globals (todos, attachments) get a direct user_id. Existing rows are
-- backfilled to the legacy owner at server startup (bootstrapOwner.js), which
-- has access to ADMIN_* env credentials the SQL can't see.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                 -- null for Google-only accounts
  name          TEXT,
  google_id     TEXT UNIQUE,          -- null for password-only accounts
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nullable for now; the startup backfill fills existing rows, and every insert
-- path sets it going forward.
ALTER TABLE workspaces  ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE todos       ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE attachments ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_workspaces_user  ON workspaces(user_id);
CREATE INDEX idx_todos_user       ON todos(user_id);
CREATE INDEX idx_attachments_user ON attachments(user_id);

-- Slugs were globally unique; make them unique PER USER so two people can each
-- have e.g. a "Personal" workspace.
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_slug_key;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_user_slug_key UNIQUE (user_id, slug);
