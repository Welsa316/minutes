import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const LANES = ['someday', 'considering', 'next', 'building', 'shipped'];

router.get('/', async (req, res, next) => {
  try {
    const trash = req.query.trash === 'true';
    const { rows } = await query(
      `SELECT i.*,
              (SELECT COUNT(*) FROM feedback f
                 WHERE f.idea_id = i.id AND f.workspace_id = i.workspace_id AND f.deleted_at IS NULL) AS demand,
              p.name AS project_name
       FROM ideas i
       LEFT JOIN projects p ON p.id = i.project_id AND p.workspace_id = i.workspace_id AND p.deleted_at IS NULL
       WHERE i.workspace_id = $1 AND i.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'}
       ORDER BY i.sort_order ASC, i.created_at DESC`,
      [req.workspaceId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, note, lane, effort, project_id } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO ideas (workspace_id, title, note, lane, effort, project_id)
       VALUES ($1, $2, $3, COALESCE($4, 'considering'), $5, $6) RETURNING *`,
      [req.workspaceId, title.trim(), note || null, LANES.includes(lane) ? lane : null, effort || null, project_id || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Only touch columns actually present in the body. A partial update (e.g. a drag
// sending just { lane }) leaves every other field intact, while the edit form —
// which sends the whole record — can genuinely clear a note or effort by passing
// null. (COALESCE-everything couldn't tell "omitted" from "cleared".)
router.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const sets = [];
    const vals = [];
    const add = (col, val) => { sets.push(`${col} = $${vals.push(val)}`); };

    if ('title' in body && String(body.title || '').trim()) add('title', String(body.title).trim());
    if ('note' in body) add('note', body.note || null);
    if ('lane' in body && LANES.includes(body.lane)) add('lane', body.lane);
    if ('effort' in body) add('effort', body.effort || null);
    if ('sort_order' in body && body.sort_order != null) add('sort_order', body.sort_order);
    if ('project_id' in body) add('project_id', body.project_id || null);

    if (!sets.length) {
      const cur = await query('SELECT * FROM ideas WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
      return cur.rows[0] ? res.json(cur.rows[0]) : res.status(404).json({ error: 'not found' });
    }
    vals.push(req.params.id, req.workspaceId);
    const { rows } = await query(
      `UPDATE ideas SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND workspace_id = $${vals.length} RETURNING *`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE ideas SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE ideas SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM ideas WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
