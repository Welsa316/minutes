-- Roadmap ideas become pipeline nodes with a progress value (0–100) shown as the
-- node's bar, so a goal can visibly advance toward shipped.
ALTER TABLE ideas ADD COLUMN progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);
