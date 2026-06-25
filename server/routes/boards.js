import { Router } from 'express';
import { pool, query } from '../db/index.js';

const router = Router();

const DEFAULT_LISTS = ['To do', 'Doing', 'Done'];

// Verify a board belongs to the active workspace; returns the board row or null.
async function boardInWorkspace(boardId, workspaceId) {
  const { rows } = await query('SELECT * FROM boards WHERE id = $1 AND workspace_id = $2', [boardId, workspaceId]);
  return rows[0] || null;
}

// Confirm the parent (note/meeting) exists in this workspace.
async function parentExists(type, id, workspaceId) {
  const table = type === 'note' ? 'notes' : type === 'meeting' ? 'meetings' : null;
  if (!table) return false;
  const { rows } = await query(`SELECT 1 FROM ${table} WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`, [id, workspaceId]);
  return rows.length > 0;
}

async function fetchBoard(boardId) {
  const { rows: lists } = await query(
    'SELECT id, title, sort_order FROM board_lists WHERE board_id = $1 ORDER BY sort_order ASC, id ASC',
    [boardId],
  );
  const listIds = lists.map((l) => l.id);
  let cards = [];
  if (listIds.length) {
    cards = (await query(
      'SELECT id, list_id, title, body, color, sort_order FROM board_cards WHERE list_id = ANY($1) ORDER BY sort_order ASC, id ASC',
      [listIds],
    )).rows;
  }
  const byList = new Map(lists.map((l) => [l.id, { ...l, cards: [] }]));
  for (const c of cards) byList.get(c.list_id)?.cards.push(c);
  return { lists: [...byList.values()] };
}

// Meetings split into three independent boards (one per phase); notes use ''.
const VALID_SECTIONS = new Set(['', 'pre', 'during', 'after']);

// GET (or create) the board for a parent note/meeting, optionally a named section.
router.get('/:parent_type/:parent_id', async (req, res, next) => {
  try {
    const { parent_type, parent_id } = req.params;
    const section = req.query.section || '';
    if (!['note', 'meeting'].includes(parent_type)) return res.status(400).json({ error: 'invalid parent_type' });
    if (!VALID_SECTIONS.has(section)) return res.status(400).json({ error: 'invalid section' });
    if (!(await parentExists(parent_type, parent_id, req.workspaceId))) {
      return res.status(404).json({ error: 'parent not found' });
    }

    let board = (await query(
      'SELECT * FROM boards WHERE parent_type = $1 AND parent_id = $2 AND section = $3 AND workspace_id = $4',
      [parent_type, parent_id, section, req.workspaceId],
    )).rows[0];

    if (!board) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        board = (await client.query(
          'INSERT INTO boards (workspace_id, parent_type, parent_id, section) VALUES ($1, $2, $3, $4) RETURNING *',
          [req.workspaceId, parent_type, parent_id, section],
        )).rows[0];
        for (let i = 0; i < DEFAULT_LISTS.length; i++) {
          await client.query('INSERT INTO board_lists (board_id, title, sort_order) VALUES ($1, $2, $3)', [board.id, DEFAULT_LISTS[i], i]);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const data = await fetchBoard(board.id);
    res.json({ id: board.id, title: board.title, ...data });
  } catch (e) { next(e); }
});

// --- Lists ---
router.post('/:boardId/lists', async (req, res, next) => {
  try {
    if (!(await boardInWorkspace(req.params.boardId, req.workspaceId))) return res.status(404).json({ error: 'not found' });
    const title = (req.body?.title || 'New list').trim() || 'New list';
    const { rows } = await query(
      `INSERT INTO board_lists (board_id, title, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM board_lists WHERE board_id = $1))
       RETURNING id, title, sort_order`,
      [req.params.boardId, title],
    );
    res.status(201).json({ ...rows[0], cards: [] });
  } catch (e) { next(e); }
});

// --- Cards ---
router.post('/lists/:listId/cards', async (req, res, next) => {
  try {
    // verify the list's board is in workspace
    const owns = await query(
      `SELECT 1 FROM board_lists bl JOIN boards b ON b.id = bl.board_id
       WHERE bl.id = $1 AND b.workspace_id = $2`,
      [req.params.listId, req.workspaceId],
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'not found' });
    const title = (req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await query(
      `INSERT INTO board_cards (list_id, title, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM board_cards WHERE list_id = $1))
       RETURNING id, list_id, title, body, color, sort_order`,
      [req.params.listId, title],
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/lists/:id', async (req, res, next) => {
  try {
    const owns = await query(
      'SELECT 1 FROM board_lists bl JOIN boards b ON b.id = bl.board_id WHERE bl.id = $1 AND b.workspace_id = $2',
      [req.params.id, req.workspaceId],
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'not found' });
    const { rows } = await query(
      'UPDATE board_lists SET title = COALESCE($1, title) WHERE id = $2 RETURNING id, title, sort_order',
      [req.body?.title ?? null, req.params.id],
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/lists/:id', async (req, res, next) => {
  try {
    const r = await query(
      `DELETE FROM board_lists bl USING boards b
       WHERE bl.id = $1 AND bl.board_id = b.id AND b.workspace_id = $2`,
      [req.params.id, req.workspaceId],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.put('/cards/:id', async (req, res, next) => {
  try {
    const owns = await query(
      `SELECT 1 FROM board_cards bc JOIN board_lists bl ON bl.id = bc.list_id JOIN boards b ON b.id = bl.board_id
       WHERE bc.id = $1 AND b.workspace_id = $2`,
      [req.params.id, req.workspaceId],
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const sets = [];
    const params = [];
    for (const key of ['title', 'body', 'color']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) { params.push(body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE board_cards SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, list_id, title, body, color, sort_order`,
      params,
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/cards/:id', async (req, res, next) => {
  try {
    const r = await query(
      `DELETE FROM board_cards bc USING board_lists bl, boards b
       WHERE bc.id = $1 AND bc.list_id = bl.id AND bl.board_id = b.id AND b.workspace_id = $2`,
      [req.params.id, req.workspaceId],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

// --- Arrange (persist a drag): rewrites list order + each list's card order/list_id ---
router.put('/:boardId/arrange', async (req, res, next) => {
  try {
    const board = await boardInWorkspace(req.params.boardId, req.workspaceId);
    if (!board) return res.status(404).json({ error: 'not found' });
    const { listOrder, lists } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Validate every list belongs to this board.
      const valid = (await client.query('SELECT id FROM board_lists WHERE board_id = $1', [board.id])).rows.map((r) => r.id);
      const validSet = new Set(valid);

      if (Array.isArray(listOrder)) {
        for (let i = 0; i < listOrder.length; i++) {
          if (validSet.has(Number(listOrder[i]))) {
            await client.query('UPDATE board_lists SET sort_order = $1 WHERE id = $2 AND board_id = $3', [i, listOrder[i], board.id]);
          }
        }
      }
      if (Array.isArray(lists)) {
        for (const l of lists) {
          if (!validSet.has(Number(l.id))) continue;
          const cardIds = Array.isArray(l.cardIds) ? l.cardIds : [];
          for (let i = 0; i < cardIds.length; i++) {
            // Only move cards that belong to this board (via any of its lists).
            await client.query(
              `UPDATE board_cards SET list_id = $1, sort_order = $2
               WHERE id = $3 AND list_id IN (SELECT id FROM board_lists WHERE board_id = $4)`,
              [l.id, i, cardIds[i], board.id],
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json(await fetchBoard(board.id));
  } catch (e) { next(e); }
});

export default router;
