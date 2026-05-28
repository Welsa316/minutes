import { ref, computed } from 'vue';

/**
 * useMultiSelect(items)
 *
 * Click → single toggle
 * Shift+click → range from last anchor to current
 * Cmd/Ctrl+click → toggle individual
 *
 * Returns { selectedIds (Set), isSelected, toggle, clear, all, count, hasSelection }
 */
export function useMultiSelect(items) {
  const selected = ref(new Set());
  let anchor = null;

  function isSelected(id) { return selected.value.has(id); }

  function toggle(id, ev) {
    const list = items.value || [];
    const next = new Set(selected.value);

    if (ev?.shiftKey && anchor != null) {
      const a = list.findIndex((x) => x.id === anchor);
      const b = list.findIndex((x) => x.id === id);
      if (a >= 0 && b >= 0) {
        const [from, to] = a < b ? [a, b] : [b, a];
        for (let i = from; i <= to; i++) next.add(list[i].id);
      }
    } else if (ev?.metaKey || ev?.ctrlKey) {
      next.has(id) ? next.delete(id) : next.add(id);
      anchor = id;
    } else {
      // Plain click on a checkbox-style toggle (called explicitly from a select handler)
      next.has(id) ? next.delete(id) : next.add(id);
      anchor = id;
    }
    selected.value = next;
  }

  function clear() { selected.value = new Set(); anchor = null; }

  function selectAll() {
    selected.value = new Set((items.value || []).map((x) => x.id));
  }

  const count = computed(() => selected.value.size);
  const hasSelection = computed(() => count.value > 0);

  return { selected, isSelected, toggle, clear, selectAll, count, hasSelection };
}
