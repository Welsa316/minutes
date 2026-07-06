import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// Todos are GLOBAL PER USER — workspace_id is an optional visual tag, not a
// filter. Mounted without workspaceScope, so req.workspaceId is irrelevant, but
// every query is scoped to req.userId so one account never sees another's todos.

router.get('/', async (req, res, next) => {
  try {
    const { done, trash, workspace_id } = req.query;
    const params = [req.userId];
    const conds = ['t.user_id = $1', trash === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
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
      `INSERT INTO todos (workspace_id, label, due_date, priority, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [workspace_id || null, label.trim(), due_date || null, priority || null, notes || null, req.userId],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Partial update — only touches keys actually present in the body, so sending
// { workspace_id: 2 } doesn't wipe due_date/notes/etc. workspace_id can be set
// to null explicitly (unassign) since null is a meaningful value here.
router.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const ALLOWED = ['label', 'due_date', 'priority', 'done', 'notes', 'workspace_id', 'sort_order'];
    const sets = [];
    const params = [];
    for (const key of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        params.push(body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'no fields to update' });
    params.push(req.params.id);
    const idPos = params.length;
    params.push(req.userId);
    const { rows } = await query(
      `UPDATE todos SET ${sets.join(', ')} WHERE id = $${idPos} AND user_id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET done = NOT done WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE todos SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE todos SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
