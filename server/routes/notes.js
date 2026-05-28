import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { tag, trash } = req.query;
    const params = [];
    const conds = [trash === 'true' ? 'n.deleted_at IS NOT NULL' : 'n.deleted_at IS NULL'];
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
       WHERE n.id = $1
       GROUP BY n.id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, body, tags } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO notes (title, body, tags)
       VALUES ($1, $2, COALESCE($3, '{}'::text[])) RETURNING *`,
      [title, body || null, Array.isArray(tags) ? tags : null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, body, tags } = req.body || {};
    const { rows } = await query(
      `UPDATE notes SET
         title = COALESCE($1, title),
         body  = $2,
         tags  = COALESCE($3, tags)
       WHERE id = $4 RETURNING *`,
      [title, body, Array.isArray(tags) ? tags : null, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE notes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE notes SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
