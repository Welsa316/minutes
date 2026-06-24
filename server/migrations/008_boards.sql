-- Trello/GitHub-Projects style boards, attachable to a note or a meeting.
-- A note can switch between a rich-text doc and a board layout.
ALTER TABLE notes ADD COLUMN layout TEXT NOT NULL DEFAULT 'doc' CHECK (layout IN ('doc', 'board'));

CREATE TABLE boards (
  id            SERIAL PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_type   TEXT NOT NULL CHECK (parent_type IN ('note', 'meeting')),
  parent_id     INTEGER NOT NULL,
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_type, parent_id)
);

CREATE TABLE board_lists (
  id          SERIAL PRIMARY KEY,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New list',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE board_cards (
  id          SERIAL PRIMARY KEY,
  list_id     INTEGER NOT NULL REFERENCES board_lists(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  color       TEXT,                 -- optional label color (hex without #)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_lists_board ON board_lists(board_id, sort_order);
CREATE INDEX idx_board_cards_list  ON board_cards(list_id, sort_order);
CREATE INDEX idx_boards_workspace  ON boards(workspace_id);
