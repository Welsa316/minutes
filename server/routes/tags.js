import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const TYPES = ['client', 'project', 'meeting', 'note'];

// List all tags with usage counts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.id, t.name, t.color, t.created_at,
             COUNT(et.id)::int AS usage_count
      FROM tags t
      LEFT JOIN entity_tags et ON et.tag_id = t.id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// Create a tag
router.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const cleanName = String(name || '').trim().replace(/^#/, '');
    if (!cleanName) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO tags (name, color) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET color = COALESCE(EXCLUDED.color, tags.color)
       RETURNING *`,
      [cleanName, color || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const { rows } = await query(
      `UPDATE tags SET name = COALESCE($1, name), color = $2 WHERE id = $3 RETURNING *`,
      [name, color, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM tags WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

// All entities for a tag (used by tag-detail page)
router.get('/:id/entities', async (req, res, next) => {
  try {
    const tagId = req.params.id;
    const [clients, projects, meetings, notes] = await Promise.all([
      query(`SELECT c.* FROM clients c JOIN entity_tags et ON et.entity_id = c.id WHERE et.entity_type='client' AND et.tag_id=$1 ORDER BY c.created_at DESC`, [tagId]),
      query(`SELECT p.* FROM projects p JOIN entity_tags et ON et.entity_id = p.id WHERE et.entity_type='project' AND et.tag_id=$1 ORDER BY p.created_at DESC`, [tagId]),
      query(`SELECT m.* FROM meetings m JOIN entity_tags et ON et.entity_id = m.id WHERE et.entity_type='meeting' AND et.tag_id=$1 ORDER BY m.date DESC NULLS LAST`, [tagId]),
      query(`SELECT n.* FROM notes n JOIN entity_tags et ON et.entity_id = n.id WHERE et.entity_type='note' AND et.tag_id=$1 ORDER BY n.created_at DESC`, [tagId]),
    ]);
    res.json({
      clients: clients.rows,
      projects: projects.rows,
      meetings: meetings.rows,
      notes: notes.rows,
    });
  } catch (e) { next(e); }
});

// Tags for one entity
router.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const { rows } = await query(
      `SELECT t.* FROM tags t
       JOIN entity_tags et ON et.tag_id = t.id
       WHERE et.entity_type = $1 AND et.entity_id = $2
       ORDER BY t.name`,
      [req.params.entity_type, req.params.entity_id],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Attach a tag to an entity (creating the tag if needed)
router.post('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const name = String(req.body?.name || '').trim().replace(/^#/, '');
    if (!name) return res.status(400).json({ error: 'name required' });
    const tag = (await query(
      `INSERT INTO tags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name],
    )).rows[0];
    await query(
      `INSERT INTO entity_tags (tag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING`,
      [tag.id, req.params.entity_type, req.params.entity_id],
    );
    res.status(201).json(tag);
  } catch (e) { next(e); }
});

// Detach a tag from an entity
router.delete('/:entity_type/:entity_id/:tag_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const r = await query(
      `DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [req.params.tag_id, req.params.entity_type, req.params.entity_id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
