import { Router } from 'express';
import { query, pool } from '../db/index.js';

const router = Router();

const STATUSES = ['draft', 'sent', 'paid'];

// Resolve an id only if it belongs to the active workspace, else null.
async function scoped(table, id, workspaceId) {
  if (id == null || id === '') return null;
  const { rows } = await query(`SELECT id FROM ${table} WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  return rows[0]?.id ?? null;
}

// Confirm an invoice belongs to the workspace (used before touching its lines).
async function ownsInvoice(id, workspaceId) {
  const { rows } = await query('SELECT id, client_id FROM invoices WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL', [id, workspaceId]);
  return rows[0] || null;
}

async function detail(id, workspaceId) {
  const { rows } = await query(
    `SELECT i.*, c.name AS client_name, c.email AS client_email, c.company AS client_company
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id AND c.workspace_id = i.workspace_id AND c.deleted_at IS NULL
     WHERE i.id = $1 AND i.workspace_id = $2`,
    [id, workspaceId],
  );
  if (!rows[0]) return null;
  const { rows: lines } = await query('SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC', [id]);
  return { ...rows[0], line_items: lines };
}

router.get('/', async (req, res, next) => {
  try {
    const trash = req.query.trash === 'true';
    const { rows } = await query(
      `SELECT i.*, c.name AS client_name,
              COALESCE((SELECT SUM(ROUND(li.qty * li.unit_cents)) FROM invoice_line_items li WHERE li.invoice_id = i.id), 0)::bigint AS subtotal_cents,
              (i.status = 'sent' AND i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE) AS overdue
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id AND c.workspace_id = i.workspace_id AND c.deleted_at IS NULL
       WHERE i.workspace_id = $1 AND i.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'}
       ORDER BY i.issue_date DESC, i.id DESC`,
      [req.workspaceId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const inv = await detail(req.params.id, req.workspaceId);
    if (!inv) return res.status(404).json({ error: 'not found' });
    res.json(inv);
  } catch (e) { next(e); }
});

// Create a draft. Auto-numbers INV-000N from the highest existing number.
router.post('/', async (req, res, next) => {
  try {
    const { client_id, due_date } = req.body || {};
    const cid = await scoped('clients', client_id, req.workspaceId);
    // Number from the highest well-formed INV-<n> only (ignore pasted PO/reference
    // numbers), as bigint so a long number can't overflow. Retry on the rare unique
    // collision from two concurrent creates.
    let row;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { rows } = await query(
          `WITH n AS (
             SELECT COALESCE(MAX(CASE WHEN number ~ '^INV-\\d+$' THEN substring(number from 5)::bigint END), 0) + 1 AS seq
             FROM invoices WHERE workspace_id = $1
           )
           INSERT INTO invoices (workspace_id, client_id, number, due_date)
           SELECT $1, $2, 'INV-' || LPAD(n.seq::text, 4, '0'), $3::date FROM n
           RETURNING *`,
          [req.workspaceId, cid, due_date || null],
        );
        row = rows[0];
        break;
      } catch (err) {
        if (err.code === '23505' && attempt < 3) continue;
        throw err;
      }
    }
    res.status(201).json({ ...row, line_items: [] });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const sets = [];
    const vals = [];
    const add = (col, val) => { sets.push(`${col} = $${vals.push(val)}`); };

    if ('number' in body) add('number', body.number || null);
    if ('issue_date' in body) add('issue_date', body.issue_date || null);
    if ('due_date' in body) add('due_date', body.due_date || null);
    if ('status' in body && STATUSES.includes(body.status)) add('status', body.status);
    if ('tax_pct' in body) add('tax_pct', Number(body.tax_pct) || 0);
    if ('notes' in body) add('notes', body.notes || null);
    if ('client_id' in body) add('client_id', await scoped('clients', body.client_id, req.workspaceId));

    if (!sets.length) {
      const inv = await detail(req.params.id, req.workspaceId);
      return inv ? res.json(inv) : res.status(404).json({ error: 'not found' });
    }
    vals.push(req.params.id, req.workspaceId);
    const { rows } = await query(
      `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND workspace_id = $${vals.length} RETURNING id`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(await detail(rows[0].id, req.workspaceId));
  } catch (e) { next(e); }
});

// --- line items ---
router.post('/:id/lines', async (req, res, next) => {
  try {
    if (!(await ownsInvoice(req.params.id, req.workspaceId))) return res.status(404).json({ error: 'not found' });
    const { label, qty, unit_cents } = req.body || {};
    const { rows: ord } = await query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS s FROM invoice_line_items WHERE invoice_id = $1', [req.params.id]);
    const { rows } = await query(
      `INSERT INTO invoice_line_items (invoice_id, label, qty, unit_cents, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, label || '', Number(qty) || 0, Math.round(Number(unit_cents) || 0), ord[0].s],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/lines/:lineId', async (req, res, next) => {
  try {
    const body = req.body || {};
    const sets = [];
    const vals = [];
    const add = (col, val) => { sets.push(`${col} = $${vals.push(val)}`); };
    if ('label' in body) add('label', body.label || '');
    if ('qty' in body) add('qty', Number(body.qty) || 0);
    if ('unit_cents' in body) add('unit_cents', Math.round(Number(body.unit_cents) || 0));
    if ('sort_order' in body) add('sort_order', Math.round(Number(body.sort_order) || 0));
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.lineId, req.workspaceId);
    const { rows } = await query(
      `UPDATE invoice_line_items li SET ${sets.join(', ')}
       WHERE li.id = $${vals.length - 1}
         AND li.invoice_id IN (SELECT id FROM invoices WHERE workspace_id = $${vals.length})
       RETURNING li.*`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/lines/:lineId', async (req, res, next) => {
  try {
    const r = await query(
      `DELETE FROM invoice_line_items
       WHERE id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE workspace_id = $2)`,
      [req.params.lineId, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Pull unbilled billable time for the invoice's client into line items (one per
// project), applying a flat hourly rate, and mark those entries as billed.
router.post('/:id/from-time', async (req, res, next) => {
  const inv = await ownsInvoice(req.params.id, req.workspaceId).catch(() => null);
  if (!inv) return res.status(404).json({ error: 'not found' });
  const rate = Math.max(0, Math.round(Number(req.body?.rate_cents) || 0));

  const params = [req.workspaceId];
  let clientFilter = '';
  if (inv.client_id) { params.push(inv.client_id); clientFilter = `AND te.client_id = $${params.length}`; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the candidate entries so a concurrent from-time can't claim the same
    // hours (SKIP LOCKED → the loser simply sees fewer rows, never double-bills).
    const { rows: entries } = await client.query(
      `SELECT te.id, te.project_id, te.minutes, p.name AS project_name
       FROM time_entries te
       LEFT JOIN projects p ON p.id = te.project_id AND p.workspace_id = te.workspace_id
       WHERE te.workspace_id = $1 AND te.billable = TRUE AND te.invoice_id IS NULL
         AND te.ended_at IS NOT NULL AND te.deleted_at IS NULL ${clientFilter}
       FOR UPDATE OF te SKIP LOCKED`,
      params,
    );

    const groups = new Map();
    for (const e of entries) {
      const key = e.project_id ?? 'none';
      if (!groups.has(key)) groups.set(key, { project_name: e.project_name, mins: 0, ids: [] });
      const g = groups.get(key);
      g.mins += Number(e.minutes) || 0;
      g.ids.push(e.id);
    }

    const { rows: ord } = await client.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS s FROM invoice_line_items WHERE invoice_id = $1', [inv.id]);
    let sort = ord[0].s;
    let added = 0;
    for (const g of groups.values()) {
      const hours = Math.round((g.mins / 60) * 100) / 100;
      const label = `${g.project_name || 'Time'} — ${hours}h`;
      await client.query(
        'INSERT INTO invoice_line_items (invoice_id, label, qty, unit_cents, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [inv.id, label, hours, rate, sort++],
      );
      await client.query('UPDATE time_entries SET invoice_id = $1 WHERE id = ANY($2) AND workspace_id = $3', [inv.id, g.ids, req.workspaceId]);
      added++;
    }
    await client.query('COMMIT');
    res.json({ ...(await detail(inv.id, req.workspaceId)), added });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await query(
      'UPDATE invoices SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.workspaceId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    // Release the time that was billed on it so those hours become unbilled again.
    await query('UPDATE time_entries SET invoice_id = NULL WHERE invoice_id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE invoices SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [req.params.id, req.workspaceId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(await detail(rows[0].id, req.workspaceId));
  } catch (e) { next(e); }
});

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const r = await query('DELETE FROM invoices WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
