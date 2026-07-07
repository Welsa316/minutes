import { defineStore } from 'pinia';
import { ref } from 'vue';
import { notes as api, pinned as pinnedApi } from '../api/endpoints.js';

// Shared note-list state for the two-pane notes workspace. The rail renders from
// `list`; the editor patches the active note's row here so titles / edited-time /
// pin state update live without a reload.
export const useNotesStore = defineStore('notes', () => {
  const list = ref([]);
  const sort = ref('edited'); // edited | created | title
  const loading = ref(false);
  let loadedWs = null;

  async function load() {
    loading.value = true;
    try { list.value = await api.list({ sort: sort.value }); }
    finally { loading.value = false; }
  }

  // Load once per workspace; callers can force a reload.
  async function ensure(wsId, force = false) {
    if (!force && wsId === loadedWs && list.value.length) return;
    loadedWs = wsId;
    await load();
  }

  function setSort(s) { sort.value = s; return load(); }

  async function create() {
    const n = await api.create({ title: 'Untitled' });
    list.value.unshift(n);
    return n;
  }

  function patch(id, fields) {
    const i = list.value.findIndex((n) => n.id === Number(id));
    if (i >= 0) list.value.splice(i, 1, { ...list.value[i], ...fields });
  }

  function removeLocal(id) { list.value = list.value.filter((n) => n.id !== Number(id)); }

  async function togglePin(id, isPinned) {
    // Optimistic — reflect immediately, revert on failure.
    patch(id, { pinned: !isPinned });
    try {
      if (isPinned) await pinnedApi.remove('note', id);
      else await pinnedApi.add('note', id);
    } catch {
      patch(id, { pinned: isPinned });
    }
  }

  return { list, sort, loading, load, ensure, setSort, create, patch, removeLocal, togglePin };
});
