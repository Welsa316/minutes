import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT * FROM clients ${where} ORDER BY created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, company, email, phone, source, status, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO clients (name, company, email, phone, source, status, notes)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'lead'), $7) RETURNING *`,
      [name, company || null, email || null, phone || null, source || null, status || null, notes || null],
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
       WHERE id = $8 RETURNING *`,
      [name, company, email, phone, source, status, notes, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
