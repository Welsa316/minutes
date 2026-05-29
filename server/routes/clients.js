import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, tag, trash } = req.query;
    const params = [req.workspaceId];
    const conds = ['c.workspace_id = $1'];
    conds.push(trash === 'true' ? 'c.deleted_at IS NOT NULL' : 'c.deleted_at IS NULL');
    if (status) { params.push(status); conds.push(`c.status = $${params.length}`); }
    if (tag) {
      params.push(tag);
      conds.push(`EXISTS (SELECT 1 FROM entity_tags et2
                          JOIN tags t2 ON t2.id = et2.tag_id
                          WHERE et2.entity_type='client' AND et2.entity_id=c.id AND t2.name=$${params.length})`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const { rows } = await query(
      `SELECT c.*,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM clients c
       LEFT JOIN entity_tags et ON et.entity_type='client' AND et.entity_id=c.id
       LEFT JOIN tags t ON t.id = et.tag_id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COALESCE(JSON_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS tags
       FROM clients c
       LEFT JOIN entity_tags et ON et.entity_type='client' AND et.entity_id=c.id
       LEFT JOIN tags t ON t.id = et.tag_id
       WHERE c.id = $1 AND c.workspace_id = $2
       GROUP BY c.id`,
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, company, email, phone, source, status, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO clients (workspace_id, name, company, email, phone, source, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'lead'), $8) RETURNING *`,
      [req.workspaceId, name, company || null, email || null, phone || null, source || null, status || null, notes || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, company, email, phone, source, status, notes } = req.body || {};
    const { rows } = await query(
      `UPDATE clients SET
         name    = COALESCE($1, name),
         company = $2,
         email   = $3,
         phone   = $4,
         source  = $5,
         status  = COALESCE($6, status),
         notes   = $7
       WHERE id = $8 AND workspace_id = $9 RETURNING *`,
      [name, company, email, phone, source, status, notes, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE clients SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE clients SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM clients WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
