import { query } from '../db/index.js';

let cachedWorkspaces = null;
let cachedAt = 0;

async function getAllWorkspaces() {
  // Tiny cache — workspaces change rarely.
  if (cachedWorkspaces && Date.now() - cachedAt < 5_000) return cachedWorkspaces;
  const { rows } = await query('SELECT id, slug FROM workspaces');
  cachedWorkspaces = rows;
  cachedAt = Date.now();
  return rows;
}

export function invalidateWorkspaceCache() {
  cachedWorkspaces = null;
}

// Reads X-Workspace-Id (numeric) or X-Workspace-Slug from the request and
// attaches req.workspaceId. Falls back to the lowest-id workspace (Freelance)
// so legacy callers without the header still work.
export async function workspaceScope(req, res, next) {
  try {
    const headerId = Number(req.get('X-Workspace-Id')) || null;
    const headerSlug = req.get('X-Workspace-Slug') || null;
    const list = await getAllWorkspaces();
    let ws = null;
    if (headerId) ws = list.find((w) => w.id === headerId);
    if (!ws && headerSlug) ws = list.find((w) => w.slug === headerSlug);
    if (!ws) ws = list[0]; // default to first (Freelance after migration)
    if (!ws) return res.status(500).json({ error: 'no workspaces configured' });
    req.workspaceId = ws.id;
    req.workspaceSlug = ws.slug;
    next();
  } catch (e) { next(e); }
}
