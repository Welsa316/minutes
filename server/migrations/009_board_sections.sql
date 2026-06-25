-- A meeting can now turn each of its phases (pre / during / after) into its own
-- board independently, instead of a single board behind a separate tab.
-- Boards therefore key on (parent_type, parent_id, section). Notes use section ''.
ALTER TABLE boards ADD COLUMN section TEXT NOT NULL DEFAULT '';
ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_parent_type_parent_id_key;
ALTER TABLE boards ADD CONSTRAINT boards_parent_section_key UNIQUE (parent_type, parent_id, section);

-- Per-phase layout: each meeting section remembers doc vs board.
ALTER TABLE meetings ADD COLUMN pre_layout    TEXT NOT NULL DEFAULT 'doc' CHECK (pre_layout    IN ('doc', 'board'));
ALTER TABLE meetings ADD COLUMN during_layout TEXT NOT NULL DEFAULT 'doc' CHECK (during_layout IN ('doc', 'board'));
ALTER TABLE meetings ADD COLUMN after_layout  TEXT NOT NULL DEFAULT 'doc' CHECK (after_layout  IN ('doc', 'board'));
