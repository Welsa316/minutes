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
    // Universal home: a full-screen workspace launcher, outside the app shell.
    path: '/home',
    name: 'home',
    component: () => import('../views/WorkspacePortal.vue'),
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
      {
        path: 'notes',
        component: () => import('../views/NotesLayout.vue'),
        children: [
          { path: '',    name: 'notes', component: () => import('../views/NoteEmpty.vue') },
          { path: ':id', name: 'note',  component: () => import('../views/NoteEditor.vue') },
        ],
      },
      { path: 'tags',            name: 'tags',        component: () => import('../views/Tags.vue') },
      { path: 'tags/:name',      name: 'tag',         component: () => import('../views/TagDetail.vue') },
      { path: 'todos',           name: 'todos',       component: () => import('../views/Todos.vue') },
      { path: 'calendar',        name: 'calendar',    redirect: '/meetings?view=calendar' },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.fetchMe();

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' };
  }
  // Opening the app fresh (initial navigation, no prior route) drops you on the
  // dashboard by default — send that first landing to the universal home portal
  // instead. Internal navigation to the dashboard (from has a name) is untouched,
  // so the sidebar "Dashboard" link and the portal dive still work normally.
  if (auth.isAuthenticated && to.name === 'dashboard' && !from.name) {
    return { name: 'home' };
  }
});

// View Transitions API — when supported, route changes morph instead of cut.
// Shared elements with matching `view-transition-name` (set in components)
// fly between pages. Falls through gracefully on unsupported browsers.
const originalPush = router.push.bind(router);
const originalReplace = router.replace.bind(router);

function withTransition(fn) {
  return function (...args) {
    if (
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return new Promise((resolve, reject) => {
        document.startViewTransition(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (e) { reject(e); }
        });
      });
    }
    return fn(...args);
  };
}

router.push = withTransition(originalPush);
router.replace = withTransition(originalReplace);

export default router;
