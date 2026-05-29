import { api } from './index.js';

function crud(base) {
  return {
    list: (params) => api.get(base, { params }).then((r) => r.data),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data),
    create: (body) => api.post(base, body).then((r) => r.data),
    update: (id, body) => api.put(`${base}/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`${base}/${id}`),
    restore: (id) => api.post(`${base}/${id}/restore`).then((r) => r.data),
    purge: (id) => api.delete(`${base}/${id}/permanent`),
  };
}

export const clients = crud('/clients');
export const projects = crud('/projects');
export const meetings = crud('/meetings');
export const notes = crud('/notes');

export const actionItems = {
  ...crud('/action-items'),
  toggle: (id) => api.patch(`/action-items/${id}/toggle`).then((r) => r.data),
};

export const search = (q) =>
  api.get('/search', { params: { q } }).then((r) => r.data);

export const tags = {
  list: () => api.get('/tags').then((r) => r.data),
  create: (body) => api.post('/tags', body).then((r) => r.data),
  remove: (id) => api.delete(`/tags/${id}`),
  forEntity: (entityType, entityId) => api.get(`/tags/${entityType}/${entityId}`).then((r) => r.data),
  attach: (entityType, entityId, name) =>
    api.post(`/tags/${entityType}/${entityId}`, { name }).then((r) => r.data),
  detach: (entityType, entityId, tagId) =>
    api.delete(`/tags/${entityType}/${entityId}/${tagId}`),
  entities: (id) => api.get(`/tags/${id}/entities`).then((r) => r.data),
};

export const pinned = {
  list: () => api.get('/pinned').then((r) => r.data),
  add: (entity_type, entity_id) =>
    api.post('/pinned', { entity_type, entity_id }).then((r) => r.data),
  remove: (entity_type, entity_id) =>
    api.delete(`/pinned/${entity_type}/${entity_id}`),
};

export const savedViews = {
  list: (section) => api.get('/saved-views', { params: section ? { section } : {} }).then((r) => r.data),
  create: (body) => api.post('/saved-views', body).then((r) => r.data),
  update: (id, body) => api.put(`/saved-views/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/saved-views/${id}`),
};

export const workspaces = {
  list: () => api.get('/workspaces').then((r) => r.data),
  create: (body) => api.post('/workspaces', body).then((r) => r.data),
  update: (id, body) => api.put(`/workspaces/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/workspaces/${id}`),
};

export const todos = {
  list: (params) => api.get('/todos', { params }).then((r) => r.data),
  create: (body) => api.post('/todos', body).then((r) => r.data),
  update: (id, body) => api.put(`/todos/${id}`, body).then((r) => r.data),
  toggle: (id) => api.patch(`/todos/${id}/toggle`).then((r) => r.data),
  remove: (id) => api.delete(`/todos/${id}`),
  restore: (id) => api.post(`/todos/${id}/restore`).then((r) => r.data),
};
