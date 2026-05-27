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
    const [c, p, m, n] = await Promise.all([
      query(
        `SELECT id, name, company FROM clients
         WHERE name ILIKE $1 OR company ILIKE $1
         ORDER BY created_at DESC LIMIT 8`,
        [like],
      ),
      query(
        `SELECT id, name FROM projects
         WHERE name ILIKE $1
         ORDER BY created_at DESC LIMIT 8`,
        [like],
      ),
      query(
        `SELECT id, title, date FROM meetings
         WHERE title ILIKE $1
         ORDER BY date DESC NULLS LAST, created_at DESC LIMIT 8`,
        [like],
      ),
      query(
        `SELECT id, title FROM notes
         WHERE title ILIKE $1
         ORDER BY created_at DESC LIMIT 8`,
        [like],
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
