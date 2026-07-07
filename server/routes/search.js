import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// Pull a short plain-text snippet around the first match of `q` in an HTML body.
function snippet(html, q) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 100);
  const start = Math.max(0, i - 40);
  return (start > 0 ? '…' : '') + text.slice(start, start + 130).trim() + (start + 130 < text.length ? '…' : '');
}

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
        `SELECT id, title, body FROM notes
         WHERE workspace_id = $2 AND deleted_at IS NULL AND (title ILIKE $1 OR body ILIKE $1)
         ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 8`,
        [like, ws],
      ),
    ]);
    res.json({
      clients: c.rows,
      projects: p.rows,
      meetings: m.rows,
      // Body is searched too now; return a snippet (and drop the raw HTML).
      notes: n.rows.map((r) => ({ id: r.id, title: r.title, snippet: snippet(r.body, q) })),
    });
  } catch (e) { next(e); }
});

export default router;
