import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { tag, trash } = req.query;
    const params = [req.workspaceId];
    const conds = ['n.workspace_id = $1'];
    conds.push(trash === 'true' ? 'n.deleted_at IS NOT NULL' : 'n.deleted_at IS NULL');
    if (tag) {
      params.push(tag);
      conds.push(`(EXISTS (SELECT 1 FROM entity_tags et2 JOIN tags t2 ON t2.id=et2.tag_id
                              WHERE et2.entity_type='note' AND et2.entity_id=n.id AND t2.name=$${params.length})
                 OR $${params.length} = ANY(n.tags))`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const { rows } = await query(
      `SELECT n.*,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS universal_tags
       FROM notes n
       LEFT JOIN entity_tags et ON et.entity_type='note' AND et.entity_id=n.id
       LEFT JOIN tags t ON t.id = et.tag_id
       ${where}
       GROUP BY n.id
       ORDER BY n.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT n.*,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS universal_tags
       FROM notes n
       LEFT JOIN entity_tags et ON et.entity_type='note' AND et.entity_id=n.id
       LEFT JOIN tags t ON t.id = et.tag_id
       WHERE n.id = $1 AND n.workspace_id = $2
       GROUP BY n.id`,
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, body, tags, layout } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO notes (workspace_id, title, body, tags, layout)
       VALUES ($1, $2, $3, COALESCE($4, '{}'::text[]), COALESCE($5, 'doc')) RETURNING *`,
      [req.workspaceId, title, body || null, Array.isArray(tags) ? tags : null, layout || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, body, tags, layout } = req.body || {};
    const { rows } = await query(
      `UPDATE notes SET
         title  = COALESCE($1, title),
         body   = $2,
         tags   = COALESCE($3, tags),
         layout = COALESCE($4, layout)
       WHERE id = $5 AND workspace_id = $6 RETURNING *`,
      [title, body, Array.isArray(tags) ? tags : null, layout || null, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE notes SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE notes SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM notes WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
