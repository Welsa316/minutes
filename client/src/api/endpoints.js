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

// Servlyy founder pipeline.
export const feedback = crud('/feedback');
export const ideas = {
  ...crud('/ideas'),
  // Phases: the ordered stages inside an idea, each with a brief + nested steps.
  phases: (id) => api.get(`/ideas/${id}/phases`).then((r) => r.data),
  addPhase: (id, title) => api.post(`/ideas/${id}/phases`, { title }).then((r) => r.data),
  updatePhase: (phaseId, body) => api.put(`/ideas/phases/${phaseId}`, body).then((r) => r.data),
  removePhase: (phaseId) => api.delete(`/ideas/phases/${phaseId}`),
  reorderPhases: (id, order) => api.put(`/ideas/${id}/phases/reorder`, { order }).then((r) => r.data),
  // Steps live inside a phase.
  addStep: (phaseId, label) => api.post(`/ideas/phases/${phaseId}/steps`, { label }).then((r) => r.data),
  updateStep: (stepId, body) => api.put(`/ideas/steps/${stepId}`, body).then((r) => r.data),
  removeStep: (stepId) => api.delete(`/ideas/steps/${stepId}`),
  reorderSteps: (phaseId, order) => api.put(`/ideas/phases/${phaseId}/steps/reorder`, { order }).then((r) => r.data),
};
export const metrics = {
  list: () => api.get('/metrics').then((r) => r.data),
  save: (body) => api.post('/metrics', body).then((r) => r.data),
  remove: (id) => api.delete(`/metrics/${id}`),
  removeSeries: (metric) => api.delete(`/metrics/series/${encodeURIComponent(metric)}`),
};

export const timeEntries = {
  ...crud('/time-entries'),
  running: () => api.get('/time-entries/running').then((r) => r.data),
  start: (body) => api.post('/time-entries', body).then((r) => r.data),
  stop: (id) => api.put(`/time-entries/${id}/stop`).then((r) => r.data),
};

export const invoices = {
  ...crud('/invoices'),
  importOne: (body) => api.post('/invoices/import', body).then((r) => r.data),
  addLine: (id, body) => api.post(`/invoices/${id}/lines`, body).then((r) => r.data),
  updateLine: (lineId, body) => api.put(`/invoices/lines/${lineId}`, body).then((r) => r.data),
  removeLine: (lineId) => api.delete(`/invoices/lines/${lineId}`),
  fromTime: (id, rate_cents) => api.post(`/invoices/${id}/from-time`, { rate_cents }).then((r) => r.data),
};

export const search = (q) =>
  api.get('/search', { params: { q } }).then((r) => r.data);

// Global — spans every workspace (not workspace-scoped).
export const dashboard = {
  get: () => api.get('/dashboard').then((r) => r.data),
};

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

export const boards = {
  get: (parentType, parentId, section = '') =>
    api.get(`/boards/${parentType}/${parentId}`, { params: section ? { section } : {} }).then((r) => r.data),
  addList: (boardId, title) => api.post(`/boards/${boardId}/lists`, { title }).then((r) => r.data),
  renameList: (listId, title) => api.put(`/boards/lists/${listId}`, { title }).then((r) => r.data),
  removeList: (listId) => api.delete(`/boards/lists/${listId}`),
  addCard: (listId, title) => api.post(`/boards/lists/${listId}/cards`, { title }).then((r) => r.data),
  updateCard: (cardId, body) => api.put(`/boards/cards/${cardId}`, body).then((r) => r.data),
  removeCard: (cardId) => api.delete(`/boards/cards/${cardId}`),
  arrange: (boardId, payload) => api.put(`/boards/${boardId}/arrange`, payload).then((r) => r.data),
};
