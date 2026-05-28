import { defineStore } from 'pinia';
import { ref } from 'vue';

let nextId = 1;

export const useToastStore = defineStore('toast', () => {
  const items = ref([]);

  function show(message, opts = {}) {
    const id = nextId++;
    const t = {
      id,
      message,
      kind: opts.kind || 'info',
      ttl: opts.ttl ?? 3000,
      // Optional undo affordance
      action: opts.action || null,        // { label, run() }
      countdownStart: opts.action ? Date.now() : null,
    };
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

  async function runAction(id) {
    const t = items.value.find((x) => x.id === id);
    if (!t?.action) return;
    try { await t.action.run(); } catch {}
    dismiss(id);
  }

  return { items, show, info, success, error, dismiss, runAction };
});
