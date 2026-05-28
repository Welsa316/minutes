-- Universal tags: polymorphic over clients, projects, meetings, notes.
CREATE TABLE tags (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (entity, tag). entity_type is constrained.
CREATE TABLE entity_tags (
  id           SERIAL PRIMARY KEY,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'meeting', 'note')),
  entity_id    INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX idx_entity_tags_tag    ON entity_tags(tag_id);

-- Pinned items in the sidebar.
CREATE TABLE pinned (
  id           SERIAL PRIMARY KEY,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'meeting', 'note')),
  entity_id    INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX idx_pinned_sort ON pinned(sort_order, created_at);

-- Saved views: a named filter combination scoped to one section.
CREATE TABLE saved_views (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  section      TEXT NOT NULL CHECK (section IN ('clients', 'projects', 'meetings', 'notes')),
  filters      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_views_section ON saved_views(section);
