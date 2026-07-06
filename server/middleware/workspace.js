import { query } from '../db/index.js';

// No-op kept for import compatibility (there is no longer a global cache — we
// query per request, scoped to the user, so nothing can leak across accounts).
export function invalidateWorkspaceCache() {}

// Resolve the active workspace from the request header, but ONLY among the
// logged-in user's workspaces. This is the isolation boundary: every
// workspace-scoped route filters by req.workspaceId, so as long as we never
// hand back someone else's workspace, their data stays private.
export async function workspaceScope(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const headerId = Number(req.get('X-Workspace-Id')) || null;
    const headerSlug = req.get('X-Workspace-Slug') || null;

    let ws = null;
    if (headerId) {
      ws = (await query('SELECT id, slug FROM workspaces WHERE id = $1 AND user_id = $2', [headerId, userId])).rows[0];
    }
    if (!ws && headerSlug) {
      ws = (await query('SELECT id, slug FROM workspaces WHERE slug = $1 AND user_id = $2', [headerSlug, userId])).rows[0];
    }
    if (!ws) {
      ws = (await query('SELECT id, slug FROM workspaces WHERE user_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1', [userId])).rows[0];
    }
    if (!ws) return res.status(404).json({ error: 'no workspace', code: 'NO_WORKSPACE' });

    req.workspaceId = ws.id;
    req.workspaceSlug = ws.slug;
    next();
  } catch (e) { next(e); }
}
