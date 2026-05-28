import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../components/AppLayout.vue'),
    children: [
      { path: '',                name: 'dashboard',   component: () => import('../views/Dashboard.vue') },
      { path: 'clients',         name: 'clients',     component: () => import('../views/Clients.vue') },
      { path: 'clients/:id',     name: 'client',      component: () => import('../views/ClientDetail.vue') },
      { path: 'projects',        name: 'projects',    component: () => import('../views/Projects.vue') },
      { path: 'projects/:id',    name: 'project',     component: () => import('../views/ProjectDetail.vue') },
      { path: 'meetings',        name: 'meetings',    component: () => import('../views/Meetings.vue') },
      { path: 'meetings/new',    name: 'meeting-new', component: () => import('../views/MeetingNew.vue') },
      { path: 'meetings/:id',    name: 'meeting',     component: () => import('../views/MeetingDetail.vue') },
      { path: 'notes',           name: 'notes',       component: () => import('../views/Notes.vue') },
      { path: 'notes/:id',       name: 'note',        component: () => import('../views/NoteDetail.vue') },
      { path: 'tags',            name: 'tags',        component: () => import('../views/Tags.vue') },
      { path: 'tags/:name',      name: 'tag',         component: () => import('../views/TagDetail.vue') },
      { path: 'calendar',        name: 'calendar',    redirect: '/meetings?view=calendar' },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.fetchMe();

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }
});

export default router;
