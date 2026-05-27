import { api } from './index.js';

function crud(base) {
  return {
    list: (params) => api.get(base, { params }).then((r) => r.data),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data),
    create: (body) => api.post(base, body).then((r) => r.data),
    update: (id, body) => api.put(`${base}/${id}`, body).then((r) => r.data),
    remove: (id) => api.delete(`${base}/${id}`),
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
