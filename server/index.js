import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import projectsRoutes from './routes/projects.js';
import meetingsRoutes from './routes/meetings.js';
import notesRoutes from './routes/notes.js';
import actionItemsRoutes from './routes/actionItems.js';
import searchRoutes from './routes/search.js';
import tagsRoutes from './routes/tags.js';
import pinnedRoutes from './routes/pinned.js';
import savedViewsRoutes from './routes/savedViews.js';
import workspacesRoutes from './routes/workspaces.js';
import todosRoutes from './routes/todos.js';
import uploadsRoutes from './routes/uploads.js';
import boardsRoutes from './routes/boards.js';
import { workspaceScope } from './middleware/workspace.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === 'production';

// CORS: in dev the client runs at :5173. In prod the server typically serves
// the built client itself (same origin) so CORS is effectively unused, but if
// you split services set CLIENT_ORIGIN.
const allowedOrigins = isProd
  ? [process.env.CLIENT_ORIGIN].filter(Boolean)
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

// Workspaces themselves are NOT scoped to a workspace — they're the registry.
app.use('/api/workspaces', requireAuth, workspacesRoutes);

// Everything else operates inside the active workspace.
app.use('/api/clients',      requireAuth, workspaceScope, clientsRoutes);
app.use('/api/projects',     requireAuth, workspaceScope, projectsRoutes);
app.use('/api/meetings',     requireAuth, workspaceScope, meetingsRoutes);
app.use('/api/notes',        requireAuth, workspaceScope, notesRoutes);
app.use('/api/action-items', requireAuth, workspaceScope, actionItemsRoutes);
app.use('/api/search',       requireAuth, workspaceScope, searchRoutes);
app.use('/api/tags',         requireAuth, workspaceScope, tagsRoutes);
app.use('/api/pinned',       requireAuth, workspaceScope, pinnedRoutes);
app.use('/api/saved-views',  requireAuth, workspaceScope, savedViewsRoutes);

// Todos are app-global. No workspaceScope.
app.use('/api/todos',        requireAuth, todosRoutes);

// Image attachments — global, auth-protected.
app.use('/api/uploads',      requireAuth, uploadsRoutes);

// Boards (Trello-style) attached to notes/meetings — workspace-scoped.
app.use('/api/boards',       requireAuth, workspaceScope, boardsRoutes);

// In production, serve the built client from /client/dist. SPA fallback: any
// non-/api request goes to index.html so vue-router can handle the route.
if (isProd) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('[warn] NODE_ENV=production but client/dist not found — run `npm run build`');
  }
}

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minutes server listening on :${PORT} (${isProd ? 'production' : 'development'})`);
});
