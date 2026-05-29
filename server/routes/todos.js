import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { done, trash } = req.query;
    const params = [req.workspaceId];
    const conds = ['workspace_id = $1'];
    conds.push(trash === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
    if (done === 'true' || done === 'false') {
      params.push(done === 'true');
      conds.push(`done = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM todos WHERE ${conds.join(' AND ')}
       ORDER BY done ASC, due_date ASC NULLS LAST, sort_order ASC, created_at ASC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { label, due_date, priority, notes } = req.body || {};
    if (!label?.trim()) return res.status(400).json({ error: 'label required' });
    const { rows } = await query(
      `INSERT INTO todos (workspace_id, label, due_date, priority, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.workspaceId, label.trim(), due_date || null, priority || null, notes || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { label, due_date, priority, done, notes, sort_order } = req.body || {};
    const { rows } = await query(
      `UPDATE todos SET
         label      = COALESCE($1, label),
         due_date   = $2,
         priority   = $3,
         done       = COALESCE($4, done),
         notes      = $5,
         sort_order = COALESCE($6, sort_order)
       WHERE id = $7 AND workspace_id = $8 RETURNING *`,
      [label, due_date, priority, done, notes, sort_order, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET done = NOT done WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE todos SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
