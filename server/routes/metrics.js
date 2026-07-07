import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const UNITS = ['count', 'currency', 'percent'];

// Every live snapshot for the workspace, oldest-first so the client can build a
// series/sparkline per metric.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM metric_snapshots
       WHERE workspace_id = $1 AND deleted_at IS NULL
       ORDER BY metric ASC, period ASC`,
      [req.workspaceId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Upsert one snapshot — logging the same metric for a period you already logged
// overwrites it (and revives it if it had been soft-deleted).
router.post('/', async (req, res, next) => {
  try {
    const { metric, value_num, unit, period } = req.body || {};
    if (!metric?.trim() || value_num == null || value_num === '' || !period) {
      return res.status(400).json({ error: 'metric, value_num and period are required' });
    }
    const u = UNITS.includes(unit) ? unit : 'count';
    const { rows } = await query(
      `INSERT INTO metric_snapshots (workspace_id, metric, value_num, unit, period)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, metric, period)
       DO UPDATE SET value_num = EXCLUDED.value_num, unit = EXCLUDED.unit, deleted_at = NULL
       RETURNING *`,
      [req.workspaceId, metric.trim(), value_num, u, period],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Drop a whole metric series (every snapshot under that name).
router.delete('/series/:metric', async (req, res, next) => {
  try {
    await query(
      'UPDATE metric_snapshots SET deleted_at = NOW() WHERE workspace_id = $1 AND metric = $2 AND deleted_at IS NULL',
      [req.workspaceId, req.params.metric],
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

// Drop a single snapshot.
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE metric_snapshots SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
