import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ clients: [], projects: [], meetings: [], notes: [] });
    }
    const like = `%${q}%`;
    const ws = req.workspaceId;
    const [c, p, m, n] = await Promise.all([
      query(
        `SELECT id, name, company FROM clients
         WHERE workspace_id = $2 AND deleted_at IS NULL AND (name ILIKE $1 OR company ILIKE $1)
         ORDER BY created_at DESC LIMIT 8`,
        [like, ws],
      ),
      query(
        `SELECT id, name FROM projects
         WHERE workspace_id = $2 AND deleted_at IS NULL AND name ILIKE $1
         ORDER BY created_at DESC LIMIT 8`,
        [like, ws],
      ),
      query(
        `SELECT id, title, date FROM meetings
         WHERE workspace_id = $2 AND deleted_at IS NULL AND title ILIKE $1
         ORDER BY date DESC NULLS LAST, created_at DESC LIMIT 8`,
        [like, ws],
      ),
      query(
        `SELECT id, title FROM notes
         WHERE workspace_id = $2 AND deleted_at IS NULL AND title ILIKE $1
         ORDER BY created_at DESC LIMIT 8`,
        [like, ws],
      ),
    ]);
    res.json({
      clients: c.rows,
      projects: p.rows,
      meetings: m.rows,
      notes: n.rows,
    });
  } catch (e) { next(e); }
});

export default router;
