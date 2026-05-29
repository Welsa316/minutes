import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// Todos are GLOBAL — workspace_id is an optional visual tag, not a filter.
// Mounted without workspaceScope so req.workspaceId is irrelevant here.

router.get('/', async (req, res, next) => {
  try {
    const { done, trash, workspace_id } = req.query;
    const params = [];
    const conds = [trash === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
    if (done === 'true' || done === 'false') {
      params.push(done === 'true');
      conds.push(`done = $${params.length}`);
    }
    if (workspace_id === 'none') {
      conds.push('workspace_id IS NULL');
    } else if (workspace_id) {
      params.push(workspace_id);
      conds.push(`workspace_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT t.*, w.slug AS workspace_slug, w.name AS workspace_name, w.color AS workspace_color, w.icon AS workspace_icon
       FROM todos t
       LEFT JOIN workspaces w ON w.id = t.workspace_id
       WHERE ${conds.join(' AND ')}
       ORDER BY done ASC, due_date ASC NULLS LAST, sort_order ASC, created_at ASC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { label, due_date, priority, notes, workspace_id } = req.body || {};
    if (!label?.trim()) return res.status(400).json({ error: 'label required' });
    const { rows } = await query(
      `INSERT INTO todos (workspace_id, label, due_date, priority, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [workspace_id || null, label.trim(), due_date || null, priority || null, notes || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { label, due_date, priority, done, notes, workspace_id, sort_order } = req.body || {};
    const { rows } = await query(
      `UPDATE todos SET
         label        = COALESCE($1, label),
         due_date     = $2,
         priority     = $3,
         done         = COALESCE($4, done),
         notes        = $5,
         workspace_id = $6,
         sort_order   = COALESCE($7, sort_order)
       WHERE id = $8 RETURNING *`,
      [label, due_date, priority, done, notes, workspace_id ?? null, sort_order, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE todos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
