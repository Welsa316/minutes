import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, client_id, tag, trash } = req.query;
    const params = [];
    const conds = [trash === 'true' ? 'p.deleted_at IS NOT NULL' : 'p.deleted_at IS NULL'];
    if (status) { params.push(status); conds.push(`p.status = $${params.length}`); }
    if (client_id) { params.push(client_id); conds.push(`p.client_id = $${params.length}`); }
    if (tag) {
      params.push(tag);
      conds.push(`EXISTS (SELECT 1 FROM entity_tags et2 JOIN tags t2 ON t2.id=et2.tag_id
                          WHERE et2.entity_type='project' AND et2.entity_id=p.id AND t2.name=$${params.length})`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const { rows } = await query(
      `SELECT p.*, c.name AS client_name,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN entity_tags et ON et.entity_type='project' AND et.entity_id=p.id
       LEFT JOIN tags t ON t.id = et.tag_id
       ${where}
       GROUP BY p.id, c.name
       ORDER BY p.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS client_name,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN entity_tags et ON et.entity_type='project' AND et.entity_id=p.id
       LEFT JOIN tags t ON t.id = et.tag_id
       WHERE p.id = $1
       GROUP BY p.id, c.name`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, client_id, status, deadline, budget_cents, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO projects (name, client_id, status, deadline, budget_cents, description)
       VALUES ($1, $2, COALESCE($3, 'proposed'), $4, $5, $6) RETURNING *`,
      [name, client_id || null, status || null, deadline || null, budget_cents ?? null, description || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, client_id, status, deadline, budget_cents, description } = req.body || {};
    const { rows } = await query(
      `UPDATE projects SET
         name         = COALESCE($1, name),
         client_id    = $2,
         status       = COALESCE($3, status),
         deadline     = $4,
         budget_cents = $5,
         description  = $6
       WHERE id = $7 RETURNING *`,
      [name, client_id, status, deadline, budget_cents, description, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE projects SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE projects SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
