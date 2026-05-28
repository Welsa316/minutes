import { ref, watch, onBeforeUnmount } from 'vue';

/**
 * useAutosave({ data, save, key, delay })
 *
 * - Watches `data` (a ref of the editable object) deeply.
 * - When it changes, waits `delay` ms of quiet time, then calls `save(snapshot)`.
 * - Also writes drafts to localStorage under `key` (so a crash before the first
 *   server flush isn't a total loss). Cleared on a successful save.
 *
 * Exposes:
 *   status:  'idle' | 'dirty' | 'saving' | 'saved' | 'error'
 *   lastSavedAt: epoch ms or null
 *   flush(): force a save right now (used on tab close)
 *   pickupDraft(): if there's a localStorage draft for `key`, returns it
 */
export function useAutosave({ data, save, key, delay = 600 }) {
  const status = ref('idle');
  const lastSavedAt = ref(null);
  let timer = null;
  let lastSnapshot = '';

  function currentKey() {
    return typeof key === 'function' ? key() : key;
  }
  function persistDraft(payload) {
    const k = currentKey(); if (!k) return;
    try { localStorage.setItem(`minutes:draft:${k}`, JSON.stringify({ ts: Date.now(), payload })); }
    catch {}
  }
  function clearDraft() {
    const k = currentKey(); if (!k) return;
    try { localStorage.removeItem(`minutes:draft:${k}`); } catch {}
  }
  function pickupDraft() {
    const k = currentKey(); if (!k) return null;
    try {
      const raw = localStorage.getItem(`minutes:draft:${k}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  async function flush() {
    if (!data.value) return;
    const snapshot = JSON.parse(JSON.stringify(data.value));
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSnapshot) {
      status.value = 'saved';
      return;
    }
    status.value = 'saving';
    try {
      await save(snapshot);
      lastSnapshot = serialized;
      lastSavedAt.value = Date.now();
      status.value = 'saved';
      clearDraft();
    } catch (e) {
      status.value = 'error';
    }
  }

  function schedule() {
    clearTimeout(timer);
    status.value = 'dirty';
    persistDraft(data.value);
    timer = setTimeout(flush, delay);
  }

  // Initial snapshot — set after the data first lands so we don't fire on hydrate.
  function seed() {
    lastSnapshot = JSON.stringify(data.value);
    status.value = 'saved';
    lastSavedAt.value = Date.now();
  }

  watch(data, () => {
    if (!data.value) return;
    const cur = JSON.stringify(data.value);
    if (cur === lastSnapshot) return;
    schedule();
  }, { deep: true });

  // Make a best-effort flush when the user closes the tab.
  const beforeUnload = () => {
    if (status.value === 'dirty' || status.value === 'saving') {
      // Synchronously fire the request via sendBeacon-like fallback — best effort.
      // Our backend uses cookies for auth, so navigator.sendBeacon won't carry them
      // by default. The localStorage draft is the real safety net here.
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnload);
    clearTimeout(timer);
  });

  return { status, lastSavedAt, flush, seed, clearDraft, pickupDraft };
}
