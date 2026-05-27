-- Minutes initial schema

CREATE TABLE clients (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  source      TEXT CHECK (source IS NULL OR source IN ('referral', 'cold', 'repeat')),
  status      TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'paused', 'archived')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  client_id     INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'on_hold', 'done')),
  deadline      DATE,
  budget_cents  INTEGER,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meetings (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  date        TIMESTAMPTZ,
  location    TEXT CHECK (location IS NULL OR location IN ('in-person', 'phone', 'video')),
  pre_notes   TEXT,
  live_notes  TEXT,
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE action_items (
  id          SERIAL PRIMARY KEY,
  meeting_id  INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  due_date    DATE,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for foreign keys and commonly-filtered columns
CREATE INDEX idx_projects_client_id      ON projects(client_id);
CREATE INDEX idx_meetings_client_id      ON meetings(client_id);
CREATE INDEX idx_meetings_project_id     ON meetings(project_id);
CREATE INDEX idx_meetings_date_desc      ON meetings(date DESC);
CREATE INDEX idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX idx_action_items_done       ON action_items(done) WHERE done = FALSE;
CREATE INDEX idx_clients_status          ON clients(status);
CREATE INDEX idx_projects_status         ON projects(status);
CREATE INDEX idx_notes_created           ON notes(created_at DESC);
