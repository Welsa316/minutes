import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { meeting_id, done } = req.query;
    const params = [];
    const where = [];
    if (meeting_id) { params.push(meeting_id); where.push(`meeting_id = $${params.length}`); }
    if (done === 'true' || done === 'false') {
      params.push(done === 'true');
      where.push(`done = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM action_items ${clause} ORDER BY done ASC, due_date ASC NULLS LAST, created_at ASC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { meeting_id, label, due_date, done } = req.body || {};
    if (!meeting_id || !label) return res.status(400).json({ error: 'meeting_id and label required' });
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
      `UPDATE action_items SET
         label    = COALESCE($1, label),
         due_date = $2,
         done     = COALESCE($3, done)
       WHERE id = $4 RETURNING *`,
      [label, due_date, done, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Convenience endpoint for the inline checkbox toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE action_items SET done = NOT done WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM action_items WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
