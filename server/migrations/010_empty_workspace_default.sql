-- Workspaces now start empty: the user adds modules ("sections") deliberately,
-- rather than every workspace pre-exposing all tabs. Existing workspaces keep
-- whatever sections they already have (Freelance keeps everything).
ALTER TABLE workspaces ALTER COLUMN sections SET DEFAULT '[]'::jsonb;
