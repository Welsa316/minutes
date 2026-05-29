import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();
const SECTIONS = ['clients', 'projects', 'meetings', 'notes'];

router.get('/', async (req, res, next) => {
  try {
    const { section } = req.query;
    const params = [req.workspaceId];
    const conds = ['workspace_id = $1'];
    if (section) {
      params.push(section);
      conds.push(`section = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM saved_views WHERE ${conds.join(' AND ')} ORDER BY section, name`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, section, filters } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'invalid section' });
    const { rows } = await query(
      `INSERT INTO saved_views (workspace_id, name, section, filters) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.workspaceId, name.trim(), section, filters || {}],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, filters } = req.body || {};
    const { rows } = await query(
      `UPDATE saved_views SET name = COALESCE($1, name), filters = COALESCE($2, filters)
       WHERE id = $3 AND workspace_id = $4 RETURNING *`,
      [name, filters, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM saved_views WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
