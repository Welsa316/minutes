import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { client_id, project_id, upcoming, tag, from, to, trash } = req.query;
    const params = [req.workspaceId];
    const conds = ['m.workspace_id = $1'];
    conds.push(trash === 'true' ? 'm.deleted_at IS NOT NULL' : 'm.deleted_at IS NULL');
    if (client_id) { params.push(client_id); conds.push(`m.client_id = $${params.length}`); }
    if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
    if (upcoming === 'true') { conds.push(`m.date >= NOW()`); }
    if (from) { params.push(from); conds.push(`m.date >= $${params.length}`); }
    if (to) { params.push(to); conds.push(`m.date <= $${params.length}`); }
    if (tag) {
      params.push(tag);
      conds.push(`EXISTS (SELECT 1 FROM entity_tags et2 JOIN tags t2 ON t2.id=et2.tag_id
                          WHERE et2.entity_type='meeting' AND et2.entity_id=m.id AND t2.name=$${params.length})`);
    }
    const clause = `WHERE ${conds.join(' AND ')}`;
    const order = upcoming === 'true' ? 'ORDER BY m.date ASC' : 'ORDER BY m.date DESC NULLS LAST, m.created_at DESC';
    const { rows } = await query(
      `SELECT m.*,
              c.name AS client_name,
              p.name AS project_name,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM meetings m
       LEFT JOIN clients c  ON c.id = m.client_id
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN entity_tags et ON et.entity_type='meeting' AND et.entity_id=m.id
       LEFT JOIN tags t ON t.id = et.tag_id
       ${clause}
       GROUP BY m.id, c.name, p.name
       ${order}`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: mrows } = await query(
      `SELECT m.*,
              c.name AS client_name,
              p.name AS project_name,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM meetings m
       LEFT JOIN clients c  ON c.id = m.client_id
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN entity_tags et ON et.entity_type='meeting' AND et.entity_id=m.id
       LEFT JOIN tags t ON t.id = et.tag_id
       WHERE m.id = $1 AND m.workspace_id = $2
       GROUP BY m.id, c.name, p.name`,
      [req.params.id, req.workspaceId],
    );
    if (!mrows[0]) return res.status(404).json({ error: 'not found' });
    const { rows: actionItems } = await query(
      'SELECT * FROM action_items WHERE meeting_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
      [req.params.id],
    );
    res.json({ ...mrows[0], action_items: actionItems });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, client_id, project_id, date, location, pre_notes, live_notes, summary } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO meetings (workspace_id, title, client_id, project_id, date, location, pre_notes, live_notes, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.workspaceId,
        title,
        client_id || null,
        project_id || null,
        date || null,
        location || null,
        pre_notes || null,
        live_notes || null,
        summary || null,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, client_id, project_id, date, location, pre_notes, live_notes, summary } = req.body || {};
    const { rows } = await query(
      `UPDATE meetings SET
         title       = COALESCE($1, title),
         client_id   = $2,
         project_id  = $3,
         date        = $4,
         location    = $5,
         pre_notes   = $6,
         live_notes  = $7,
         summary     = $8
       WHERE id = $9 AND workspace_id = $10 RETURNING *`,
      [title, client_id, project_id, date, location, pre_notes, live_notes, summary, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE meetings SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE meetings SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM meetings WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
