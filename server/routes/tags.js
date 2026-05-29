import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const TYPES = ['client', 'project', 'meeting', 'note'];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.id, t.name, t.color, t.created_at,
             COUNT(et.id)::int AS usage_count
      FROM tags t
      LEFT JOIN entity_tags et ON et.tag_id = t.id
      WHERE t.workspace_id = $1
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
    `, [req.workspaceId]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const cleanName = String(name || '').trim().replace(/^#/, '');
    if (!cleanName) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO tags (workspace_id, name, color) VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, name) DO UPDATE SET color = COALESCE(EXCLUDED.color, tags.color)
       RETURNING *`,
      [req.workspaceId, cleanName, color || null],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const { rows } = await query(
      `UPDATE tags SET name = COALESCE($1, name), color = $2
       WHERE id = $3 AND workspace_id = $4 RETURNING *`,
      [name, color, req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM tags WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/:id/entities', async (req, res, next) => {
  try {
    const tagId = req.params.id;
    const ws = req.workspaceId;
    const [clients, projects, meetings, notes] = await Promise.all([
      query(`SELECT c.* FROM clients c JOIN entity_tags et ON et.entity_id = c.id
             WHERE et.entity_type='client' AND et.tag_id=$1 AND c.workspace_id=$2 AND c.deleted_at IS NULL
             ORDER BY c.created_at DESC`, [tagId, ws]),
      query(`SELECT p.* FROM projects p JOIN entity_tags et ON et.entity_id = p.id
             WHERE et.entity_type='project' AND et.tag_id=$1 AND p.workspace_id=$2 AND p.deleted_at IS NULL
             ORDER BY p.created_at DESC`, [tagId, ws]),
      query(`SELECT m.* FROM meetings m JOIN entity_tags et ON et.entity_id = m.id
             WHERE et.entity_type='meeting' AND et.tag_id=$1 AND m.workspace_id=$2 AND m.deleted_at IS NULL
             ORDER BY m.date DESC NULLS LAST`, [tagId, ws]),
      query(`SELECT n.* FROM notes n JOIN entity_tags et ON et.entity_id = n.id
             WHERE et.entity_type='note' AND et.tag_id=$1 AND n.workspace_id=$2 AND n.deleted_at IS NULL
             ORDER BY n.created_at DESC`, [tagId, ws]),
    ]);
    res.json({
      clients: clients.rows,
      projects: projects.rows,
      meetings: meetings.rows,
      notes: notes.rows,
    });
  } catch (e) { next(e); }
});

router.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const { rows } = await query(
      `SELECT t.* FROM tags t
       JOIN entity_tags et ON et.tag_id = t.id
       WHERE et.entity_type = $1 AND et.entity_id = $2 AND t.workspace_id = $3
       ORDER BY t.name`,
      [req.params.entity_type, req.params.entity_id, req.workspaceId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const name = String(req.body?.name || '').trim().replace(/^#/, '');
    if (!name) return res.status(400).json({ error: 'name required' });
    const tag = (await query(
      `INSERT INTO tags (workspace_id, name) VALUES ($1, $2)
       ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [req.workspaceId, name],
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

router.delete('/:entity_type/:entity_id/:tag_id', async (req, res, next) => {
  try {
    if (!TYPES.includes(req.params.entity_type)) return res.status(400).json({ error: 'invalid entity_type' });
    const r = await query(
      `DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3
       AND EXISTS (SELECT 1 FROM tags WHERE id = $1 AND workspace_id = $4)`,
      [req.params.tag_id, req.params.entity_type, req.params.entity_id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
