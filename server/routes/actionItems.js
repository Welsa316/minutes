import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// Action items inherit their workspace from the parent meeting. Every query
// joins meetings.workspace_id so a stale or guessed meeting_id from another
// workspace can't be read or mutated.

router.get('/', async (req, res, next) => {
  try {
    const { meeting_id, done } = req.query;
    const params = [req.workspaceId];
    const where = ['m.workspace_id = $1', 'a.deleted_at IS NULL'];
    if (meeting_id) { params.push(meeting_id); where.push(`a.meeting_id = $${params.length}`); }
    if (done === 'true' || done === 'false') {
      params.push(done === 'true');
      where.push(`a.done = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT a.* FROM action_items a
       JOIN meetings m ON m.id = a.meeting_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.done ASC, a.due_date ASC NULLS LAST, a.created_at ASC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { meeting_id, label, due_date, done } = req.body || {};
    if (!meeting_id || !label) return res.status(400).json({ error: 'meeting_id and label required' });
    // Verify the meeting belongs to the active workspace.
    const ok = await query(
      'SELECT 1 FROM meetings WHERE id = $1 AND workspace_id = $2',
      [meeting_id, req.workspaceId],
    );
    if (!ok.rowCount) return res.status(404).json({ error: 'meeting not found' });
    const { rows } = await query(
      `INSERT INTO action_items (meeting_id, label, due_date, done)
       VALUES ($1, $2, $3, COALESCE($4, FALSE)) RETURNING *`,
      [meeting_id, label, due_date || null, done],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { label, due_date, done } = req.body || {};
    const { rows } = await query(
      `UPDATE action_items a SET
         label    = COALESCE($1, label),
         due_date = $2,
         done     = COALESCE($3, done)
       FROM meetings m
       WHERE a.id = $4 AND a.meeting_id = m.id AND m.workspace_id = $5
       RETURNING a.*`,
      [label, due_date, done, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE action_items a SET done = NOT a.done
       FROM meetings m
       WHERE a.id = $1 AND a.meeting_id = m.id AND m.workspace_id = $2
       RETURNING a.*`,
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      `DELETE FROM action_items a USING meetings m
       WHERE a.id = $1 AND a.meeting_id = m.id AND m.workspace_id = $2`,
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
