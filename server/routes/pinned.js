import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();
const TYPES = ['client', 'project', 'meeting', 'note'];

// List pinned items with their joined display data
router.get('/', async (req, res, next) => {
  try {
    const { rows: pins } = await query(
      'SELECT * FROM pinned ORDER BY sort_order ASC, created_at ASC',
    );
    if (!pins.length) return res.json([]);

    const byType = { client: [], project: [], meeting: [], note: [] };
    for (const p of pins) byType[p.entity_type].push(p.entity_id);

    const [c, p, m, n] = await Promise.all([
      byType.client.length ? query(`SELECT id, name FROM clients WHERE id = ANY($1)`, [byType.client]) : { rows: [] },
      byType.project.length ? query(`SELECT id, name FROM projects WHERE id = ANY($1)`, [byType.project]) : { rows: [] },
      byType.meeting.length ? query(`SELECT id, title FROM meetings WHERE id = ANY($1)`, [byType.meeting]) : { rows: [] },
      byType.note.length ? query(`SELECT id, title FROM notes WHERE id = ANY($1)`, [byType.note]) : { rows: [] },
    ]);
    const indexBy = (arr, key) => Object.fromEntries(arr.map((r) => [r.id, r[key]]));
    const names = {
      client: indexBy(c.rows, 'name'),
      project: indexBy(p.rows, 'name'),
      meeting: indexBy(m.rows, 'title'),
      note: indexBy(n.rows, 'title'),
    };
    const enriched = pins
      .map((pin) => ({ ...pin, title: names[pin.entity_type][pin.entity_id] }))
      .filter((pin) => pin.title != null);
    res.json(enriched);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { entity_type, entity_id } = req.body || {};
    if (!TYPES.includes(entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    if (!entity_id) return res.status(400).json({ error: 'entity_id required' });
    const { rows } = await query(
      `INSERT INTO pinned (entity_type, entity_id)
       VALUES ($1, $2)
       ON CONFLICT (entity_type, entity_id) DO NOTHING
       RETURNING *`,
      [entity_type, entity_id],
    );
    res.status(rows[0] ? 201 : 200).json(rows[0] || { ok: true });
  } catch (e) { next(e); }
});

router.delete('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const r = await query(
      'DELETE FROM pinned WHERE entity_type = $1 AND entity_id = $2',
      [req.params.entity_type, req.params.entity_id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
