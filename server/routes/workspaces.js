import { Router } from 'express';
import { query } from '../db/index.js';
import { invalidateWorkspaceCache } from '../middleware/workspace.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM meetings WHERE workspace_id = w.id AND deleted_at IS NULL) AS meeting_count,
        (SELECT COUNT(*) FROM clients  WHERE workspace_id = w.id AND deleted_at IS NULL) AS client_count,
        (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id AND deleted_at IS NULL) AS project_count,
        (SELECT COUNT(*) FROM notes    WHERE workspace_id = w.id AND deleted_at IS NULL) AS note_count,
        -- open_todo_count is this user's total (todos are global per user);
        -- duplicated on each workspace row so the switcher can display it.
        (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL AND done = FALSE AND user_id = $1) AS open_todo_count
      FROM workspaces w
      WHERE w.user_id = $1
      ORDER BY sort_order ASC, id ASC
    `, [req.userId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Find a slug not already used by this user (append -2, -3, … on collision).
async function uniqueSlug(base, userId) {
  let s = (base || 'workspace').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const root = s;
  for (let n = 2; (await query('SELECT 1 FROM workspaces WHERE user_id = $1 AND slug = $2', [userId, s])).rowCount; n++) {
    s = `${root}-${n}`;
  }
  return s;
}

router.post('/', async (req, res, next) => {
  try {
    const { name, slug, icon, color, sections } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const finalSlug = await uniqueSlug(slug || name, req.userId);
    const { rows } = await query(
      `INSERT INTO workspaces (name, slug, icon, color, sections, sort_order, user_id)
       VALUES ($1, $2, $3, $4, COALESCE($5, '[]'::jsonb),
               (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM workspaces WHERE user_id = $6), $6)
       RETURNING *`,
      [name.trim(), finalSlug, icon || null, color || null, sections ? JSON.stringify(sections) : null, req.userId],
    );
    invalidateWorkspaceCache();
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, icon, color, sections, sort_order } = req.body || {};
    const { rows } = await query(
      `UPDATE workspaces SET
         name = COALESCE($1, name),
         icon = COALESCE($2, icon),
         color = COALESCE($3, color),
         sections = COALESCE($4, sections),
         sort_order = COALESCE($5, sort_order)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, icon, color, sections ? JSON.stringify(sections) : null, sort_order, req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    invalidateWorkspaceCache();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM workspaces WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    invalidateWorkspaceCache();
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
