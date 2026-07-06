import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// The dashboard is GLOBAL PER USER — it spans every workspace the user owns, so
// it is mounted WITHOUT workspaceScope but each query filters by the workspace's
// owner (w.user_id). Each row carries its workspace (name/color) so the client
// can show where the item lives and jump into the right workspace on click.
router.get('/', async (req, res, next) => {
  try {
    const uid = [req.userId];
    const [upcoming, activeProjects, recentNotes, totals, allMeetings] = await Promise.all([
      query(`
        SELECT m.id, m.title, m.subject, m.date, m.client_id,
               c.name AS client_name,
               m.workspace_id, w.name AS workspace_name, w.color AS workspace_color, w.slug AS workspace_slug
        FROM meetings m
        LEFT JOIN clients c ON c.id = m.client_id
        JOIN workspaces w ON w.id = m.workspace_id
        WHERE m.deleted_at IS NULL AND m.date >= NOW() AND w.user_id = $1
        ORDER BY m.date ASC
        LIMIT 6
      `, uid),
      query(`
        SELECT p.id, p.name, p.status, p.deadline, p.client_id,
               c.name AS client_name,
               p.workspace_id, w.name AS workspace_name, w.color AS workspace_color, w.slug AS workspace_slug
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        JOIN workspaces w ON w.id = p.workspace_id
        WHERE p.deleted_at IS NULL AND p.status = 'active' AND w.user_id = $1
        ORDER BY p.deadline ASC NULLS LAST, p.id DESC
        LIMIT 6
      `, uid),
      query(`
        SELECT n.id, n.title, n.created_at, n.layout,
               n.workspace_id, w.name AS workspace_name, w.color AS workspace_color, w.slug AS workspace_slug
        FROM notes n
        JOIN workspaces w ON w.id = n.workspace_id
        WHERE n.deleted_at IS NULL AND w.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 6
      `, uid),
      query(`
        WITH ws AS (SELECT id FROM workspaces WHERE user_id = $1)
        SELECT
          (SELECT COUNT(*) FROM clients  WHERE deleted_at IS NULL AND workspace_id IN (SELECT id FROM ws)) AS clients,
          (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND workspace_id IN (SELECT id FROM ws)) AS projects,
          (SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL AND workspace_id IN (SELECT id FROM ws)) AS meetings,
          (SELECT COUNT(*) FROM notes    WHERE deleted_at IS NULL AND workspace_id IN (SELECT id FROM ws)) AS notes
      `, uid),
      query(`
        SELECT m.id, m.title, m.date, m.client_id,
               c.name AS client_name,
               m.workspace_id, w.name AS workspace_name, w.color AS workspace_color, w.slug AS workspace_slug
        FROM meetings m
        LEFT JOIN clients c ON c.id = m.client_id
        JOIN workspaces w ON w.id = m.workspace_id
        WHERE m.deleted_at IS NULL AND m.date IS NOT NULL AND w.user_id = $1
        ORDER BY m.date DESC
      `, uid),
    ]);

    const t = totals.rows[0];
    res.json({
      upcoming: upcoming.rows,
      activeProjects: activeProjects.rows,
      recentNotes: recentNotes.rows,
      totals: {
        clients: Number(t.clients),
        projects: Number(t.projects),
        meetings: Number(t.meetings),
        notes: Number(t.notes),
      },
      allMeetings: allMeetings.rows,
    });
  } catch (e) { next(e); }
});

export default router;
