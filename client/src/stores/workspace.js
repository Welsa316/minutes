import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { api, setApiWorkspaceId } from '../api/index.js';

const ACTIVE_KEY = 'minutes:workspace';

export const useWorkspaceStore = defineStore('workspace', () => {
  const list = ref([]);
  const activeId = ref(loadActive());
  const loading = ref(true);

  const active = computed(() => list.value.find((w) => w.id === activeId.value) || list.value[0] || null);
  const sections = computed(() => new Set(active.value?.sections || []));
  function has(section) { return sections.value.has(section); }

  function loadActive() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  }

  function persistActive() {
    try { localStorage.setItem(ACTIVE_KEY, String(activeId.value ?? '')); } catch {}
  }

  async function load() {
    loading.value = true;
    try {
      const { data } = await api.get('/workspaces');
      list.value = data;
      if (!list.value.find((w) => w.id === activeId.value)) {
        activeId.value = list.value[0]?.id ?? null;
        persistActive();
      }
    } finally {
      loading.value = false;
    }
  }

  function setActive(id) {
    activeId.value = id;
    persistActive();
    // Notify other tabs / wakers that the workspace flipped
    window.dispatchEvent(new CustomEvent('minutes:workspace-changed', { detail: { id } }));
  }

  function setActiveBySlug(slug) {
    const w = list.value.find((x) => x.slug === slug);
    if (w) setActive(w.id);
  }

  async function create(body) {
    const { data } = await api.post('/workspaces', body);
    await load();
    if (data?.id) setActive(data.id);
    return data;
  }

  // Update any workspace fields (name/icon/color/sections) and reflect locally.
  async function update(id, body) {
    const { data } = await api.put(`/workspaces/${id}`, body);
    const i = list.value.findIndex((w) => w.id === id);
    if (i >= 0) list.value.splice(i, 1, { ...list.value[i], ...data });
    return data;
  }

  // Persist a new module set for the active workspace and reflect it locally.
  async function setSections(sections) {
    const w = active.value;
    if (!w) return;
    const { data } = await api.put(`/workspaces/${w.id}`, { sections });
    const i = list.value.findIndex((x) => x.id === w.id);
    if (i >= 0) list.value.splice(i, 1, { ...list.value[i], ...data });
  }

  // Add/remove a module ("section") from the active workspace. Removing a
  // module only hides its tab — the data underneath is kept.
  async function toggleModule(key) {
    const cur = new Set(active.value?.sections || []);
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    await setSections([...cur]);
  }

  // Sync the active workspace into the axios interceptor any time it changes.
  watch(activeId, (v) => setApiWorkspaceId(v), { immediate: true });

  return { list, activeId, active, sections, has, loading, load, setActive, setActiveBySlug, create, update, setSections, toggleModule };
});

// The module types a workspace can switch on. Todos + Dashboard are global and
// not listed here. Order is the order they appear in the nav and the picker.
export const MODULES = [
  { key: 'notes',    label: 'Notes',    icon: '✎', desc: 'Rich notes, boards, and snippets.' },
  { key: 'meetings', label: 'Meetings', icon: '◷', desc: 'Prep, live notes, and action items.' },
  { key: 'clients',  label: 'Clients',  icon: '◉', desc: 'People and companies you work with.' },
  { key: 'projects', label: 'Projects', icon: '▤', desc: 'Track work with status and deadlines.' },
  { key: 'time',     label: 'Time',     icon: '◔', desc: 'Track billable hours by client and project.' },
  { key: 'invoices', label: 'Invoices', icon: '$', desc: 'Bill clients and pull in tracked time.' },
  { key: 'tags',     label: 'Tags',     icon: '#', desc: 'Cross-link everything with #tags.' },
  { key: 'feedback', label: 'Feedback', icon: '✉', desc: 'Triage product feedback into ideas.' },
  { key: 'roadmap',  label: 'Roadmap',  icon: '◈', desc: 'What to build next, by lane.' },
  { key: 'metrics',  label: 'Metrics',  icon: '∿', desc: 'Track MRR, users, and other KPIs.' },
];
