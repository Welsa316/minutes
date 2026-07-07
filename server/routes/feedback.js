import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, trash } = req.query;
    const params = [req.workspaceId];
    const conds = ['f.workspace_id = $1'];
    conds.push(trash === 'true' ? 'f.deleted_at IS NOT NULL' : 'f.deleted_at IS NULL');
    if (status) { params.push(status); conds.push(`f.status = $${params.length}`); }
    const { rows } = await query(
      `SELECT f.*, c.name AS requester_name, i.title AS idea_title, i.lane AS idea_lane
       FROM feedback f
       LEFT JOIN clients c ON c.id = f.requester_client_id AND c.workspace_id = f.workspace_id
       LEFT JOIN ideas i ON i.id = f.idea_id AND i.workspace_id = f.workspace_id AND i.deleted_at IS NULL
       WHERE ${conds.join(' AND ')}
       ORDER BY f.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, detail, source, requester_client_id, status } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO feedback (workspace_id, title, detail, source, requester_client_id, status)
       VALUES ($1, $2, $3, COALESCE($4, 'other'),
               (SELECT id FROM clients WHERE id = $5 AND workspace_id = $1),
               COALESCE($6, 'new')) RETURNING *`,
      [req.workspaceId, title.trim(), detail || null, source || null, requester_client_id || null, status || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, detail, source, requester_client_id, status, idea_id } = req.body || {};
    const { rows } = await query(
      `UPDATE feedback SET
         title               = COALESCE($1, title),
         detail              = COALESCE($2, detail),
         source              = COALESCE($3, source),
         requester_client_id = COALESCE((SELECT id FROM clients WHERE id = $4 AND workspace_id = $8), requester_client_id),
         status              = COALESCE($5, status),
         idea_id             = COALESCE((SELECT id FROM ideas WHERE id = $6 AND workspace_id = $8 AND deleted_at IS NULL), idea_id)
       WHERE id = $7 AND workspace_id = $8 RETURNING *`,
      [title, detail, source, requester_client_id || null, status, idea_id || null, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE feedback SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE feedback SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM feedback WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
