import axios from 'axios';

// Same-origin in prod, Vite proxies /api in dev — so a relative baseURL is all
// we need. `withCredentials` carries the auth cookie on every request.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
