-- Pasted/uploaded images live in the DB as bytea so they survive Railway
-- redeploys (the container filesystem is ephemeral) and stay self-contained
-- (no S3/Cloudinary dependency). Notes embed a small /api/uploads/:id URL
-- rather than base64, so autosave payloads stay tiny.
CREATE TABLE attachments (
  id          SERIAL PRIMARY KEY,
  mime        TEXT NOT NULL,
  bytes       BYTEA NOT NULL,
  size        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
