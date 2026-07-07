import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// Resolve an id to itself only if it belongs to the active workspace, else null —
// so a client/project from another workspace can never be linked or leaked.
async function scoped(table, id, workspaceId) {
  if (id == null || id === '') return null;
  const { rows } = await query(`SELECT id FROM ${table} WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  return rows[0]?.id ?? null;
}

const SELECT = `
  SELECT te.*, c.name AS client_name, p.name AS project_name
  FROM time_entries te
  LEFT JOIN clients  c ON c.id = te.client_id  AND c.workspace_id = te.workspace_id AND c.deleted_at IS NULL
  LEFT JOIN projects p ON p.id = te.project_id AND p.workspace_id = te.workspace_id AND p.deleted_at IS NULL`;

router.get('/', async (req, res, next) => {
  try {
    const trash = req.query.trash === 'true';
    const { rows } = await query(
      `${SELECT}
       WHERE te.workspace_id = $1 AND te.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'}
       ORDER BY te.started_at DESC`,
      [req.workspaceId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// The current running timer (or null). Registered before /:id-style routes.
router.get('/running', async (req, res, next) => {
  try {
    const { rows } = await query(
      `${SELECT}
       WHERE te.workspace_id = $1 AND te.ended_at IS NULL AND te.deleted_at IS NULL
       ORDER BY te.started_at DESC LIMIT 1`,
      [req.workspaceId],
    );
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

// POST with `minutes` → a completed manual entry; without → start a live timer
// (closing any timer already running in this workspace first).
router.post('/', async (req, res, next) => {
  try {
    const { client_id, project_id, note, billable, minutes, started_at, rate_cents } = req.body || {};
    const bill = billable === false ? false : true;
    const cid = await scoped('clients', client_id, req.workspaceId);
    const pid = await scoped('projects', project_id, req.workspaceId);

    if (minutes != null && minutes !== '') {
      const mins = Math.max(1, Math.round(Number(minutes)));
      if (!Number.isFinite(mins)) return res.status(400).json({ error: 'invalid minutes' });
      const { rows } = await query(
        `INSERT INTO time_entries (workspace_id, client_id, project_id, note, billable, minutes, rate_cents, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()),
                 COALESCE($8::timestamptz, NOW()) + make_interval(mins => $6))
         RETURNING *`,
        [req.workspaceId, cid, pid, note || null, bill, mins, rate_cents ?? null, started_at || null],
      );
      const { rows: full } = await query(`${SELECT} WHERE te.id = $1`, [rows[0].id]);
      return res.status(201).json(full[0]);
    }

    // Start a timer — close any open one first so only one runs at a time.
    await query(
      `UPDATE time_entries
         SET ended_at = NOW(),
             minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))
       WHERE workspace_id = $1 AND ended_at IS NULL AND deleted_at IS NULL`,
      [req.workspaceId],
    );
    let createdId;
    try {
      const { rows } = await query(
        `INSERT INTO time_entries (workspace_id, client_id, project_id, note, billable, rate_cents, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [req.workspaceId, cid, pid, note || null, bill, rate_cents ?? null],
      );
      createdId = rows[0].id;
    } catch (err) {
      // A concurrent Start won the race — hand back the timer already running.
      if (err.code === '23505') {
        const { rows } = await query(
          `${SELECT} WHERE te.workspace_id = $1 AND te.ended_at IS NULL AND te.deleted_at IS NULL ORDER BY te.started_at DESC LIMIT 1`,
          [req.workspaceId],
        );
        return res.status(200).json(rows[0] || null);
      }
      throw err;
    }
    const { rows: full } = await query(`${SELECT} WHERE te.id = $1`, [createdId]);
    res.status(201).json(full[0]);
  } catch (e) { next(e); }
});

// Stop a running timer.
router.put('/:id/stop', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE time_entries
         SET ended_at = NOW(),
             minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))
       WHERE id = $1 AND workspace_id = $2 AND ended_at IS NULL AND deleted_at IS NULL
       RETURNING *`,
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not running' });
    const { rows: full } = await query(`${SELECT} WHERE te.id = $1`, [rows[0].id]);
    res.json(full[0]);
  } catch (e) { next(e); }
});

// Edit a stored entry. Only columns present in the body are touched.
router.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const sets = [];
    const vals = [];
    const add = (col, val) => { sets.push(`${col} = $${vals.push(val)}`); };

    if ('note' in body) add('note', body.note || null);
    if ('billable' in body) add('billable', body.billable === false ? false : true);
    if ('minutes' in body && body.minutes != null && body.minutes !== '') add('minutes', Math.max(1, Math.round(Number(body.minutes))));
    if ('started_at' in body && body.started_at) add('started_at', body.started_at);
    if ('client_id' in body) add('client_id', await scoped('clients', body.client_id, req.workspaceId));
    if ('project_id' in body) add('project_id', await scoped('projects', body.project_id, req.workspaceId));

    if (!sets.length) {
      const cur = await query(`${SELECT} WHERE te.id = $1 AND te.workspace_id = $2`, [req.params.id, req.workspaceId]);
      return cur.rows[0] ? res.json(cur.rows[0]) : res.status(404).json({ error: 'not found' });
    }
    vals.push(req.params.id, req.workspaceId);
    const { rows } = await query(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND workspace_id = $${vals.length} RETURNING id`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    const { rows: full } = await query(`${SELECT} WHERE te.id = $1`, [rows[0].id]);
    res.json(full[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE time_entries SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE time_entries SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM time_entries WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
