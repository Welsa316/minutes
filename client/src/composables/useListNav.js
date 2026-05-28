import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { isTyping } from './useShortcuts.js';

/**
 * useListNav({ items, pathFor, createInput })
 *
 * - j / k step through `items`
 * - Enter opens the selected entry via the router
 * - c focuses the `createInput` ref (the inline new-row input on each list)
 *
 * Returns { selected, selectedId } for highlighting.
 */
export function useListNav({ items, pathFor, createInput }) {
  const router = useRouter();
  const selected = ref(0);
  const selectedId = computed(() => items.value[selected.value]?.id ?? null);

  function clamp() {
    if (!items.value.length) selected.value = 0;
    else if (selected.value > items.value.length - 1) selected.value = items.value.length - 1;
    else if (selected.value < 0) selected.value = 0;
  }

  function next() { selected.value = Math.min(selected.value + 1, items.value.length - 1); clamp(); }
  function prev() { selected.value = Math.max(selected.value - 1, 0); clamp(); }
  function open() {
    const item = items.value[selected.value];
    if (item && pathFor) router.push(pathFor(item));
  }
  function focusCreate(e) {
    const el = createInput?.value;
    if (!el) return;
    e?.preventDefault?.();
    el.focus();
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target)) return;
    if (e.key === 'j') { e.preventDefault(); next(); }
    else if (e.key === 'k') { e.preventDefault(); prev(); }
    else if (e.key === 'Enter') { e.preventDefault(); open(); }
    else if (e.key === 'c') { focusCreate(e); }
  }

  onMounted(() => document.addEventListener('keydown', onKey));
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

  return { selected, selectedId };
}
