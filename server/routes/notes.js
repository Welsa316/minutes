import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { tag } = req.query;
    const params = [];
    let where = '';
    if (tag) {
      params.push(tag);
      where = `WHERE $${params.length} = ANY(tags)`;
    }
    const { rows } = await query(
      `SELECT * FROM notes ${where} ORDER BY created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
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
    const r = await query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
