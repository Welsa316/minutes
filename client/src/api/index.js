import axios from 'axios';

// Same-origin in prod, Vite proxies /api in dev. `withCredentials` carries
// the auth cookie on every request.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// The workspace store sets this whenever the active workspace changes.
let currentWorkspaceId = null;
export function setApiWorkspaceId(id) { currentWorkspaceId = id; }

api.interceptors.request.use((config) => {
  if (currentWorkspaceId != null) {
    config.headers = config.headers || {};
    config.headers['X-Workspace-Id'] = String(currentWorkspaceId);
  }
  return config;
});
