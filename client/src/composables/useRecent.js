import { ref, watch } from 'vue';

const KEY = 'minutes:recent';
const MAX = 8;

const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
})();

const items = ref(stored);

watch(items, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}, { deep: true });

export function useRecent() {
  function visit(entry) {
    // entry: { kind: 'client'|'project'|'meeting'|'note', id, title }
    if (!entry?.kind || entry?.id == null) return;
    const filtered = items.value.filter((i) => !(i.kind === entry.kind && i.id === entry.id));
    filtered.unshift({ ...entry, at: Date.now() });
    items.value = filtered.slice(0, MAX);
  }
  function clear() { items.value = []; }
  return { items, visit, clear };
}
