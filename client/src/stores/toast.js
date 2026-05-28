import { defineStore } from 'pinia';
import { ref } from 'vue';

let nextId = 1;

export const useToastStore = defineStore('toast', () => {
  const items = ref([]);

  function show(message, opts = {}) {
    const id = nextId++;
    const t = { id, message, kind: opts.kind || 'info', ttl: opts.ttl ?? 3000 };
    items.value = [...items.value, t];
    if (t.ttl > 0) setTimeout(() => dismiss(id), t.ttl);
    return id;
  }
  const info = (m, o) => show(m, { ...o, kind: 'info' });
  const success = (m, o) => show(m, { ...o, kind: 'success' });
  const error = (m, o) => show(m, { ...o, kind: 'error' });

  function dismiss(id) {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return { items, show, info, success, error, dismiss };
});
