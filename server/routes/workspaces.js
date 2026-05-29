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
        (SELECT COUNT(*) FROM todos    WHERE workspace_id = w.id AND deleted_at IS NULL AND done = FALSE) AS open_todo_count
      FROM workspaces w
      ORDER BY sort_order ASC, id ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, slug, icon, color, sections } = req.body || {};
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: 'name and slug required' });
    const { rows } = await query(
      `INSERT INTO workspaces (name, slug, icon, color, sections, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, '["notes"]'::jsonb),
               (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM workspaces))
       RETURNING *`,
      [name.trim(), slug.trim().toLowerCase(), icon || null, color || null, sections ? JSON.stringify(sections) : null],
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
         icon = $2,
         color = $3,
         sections = COALESCE($4, sections),
         sort_order = COALESCE($5, sort_order)
       WHERE id = $6 RETURNING *`,
      [name, icon, color, sections ? JSON.stringify(sections) : null, sort_order, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    invalidateWorkspaceCache();
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM workspaces WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    invalidateWorkspaceCache();
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
