-- A meeting can point at a roadmap (idea) — the plan you'll walk through in it.
-- ON DELETE SET NULL so deleting the roadmap just unlinks it, never the meeting.
ALTER TABLE meetings ADD COLUMN roadmap_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL;
CREATE INDEX idx_meetings_roadmap ON meetings(roadmap_id);
