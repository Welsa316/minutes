import { onMounted, onBeforeUnmount } from 'vue';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isTyping(target) {
  if (!target) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * useShortcut(key, fn, { allowInInputs })
 *
 * key: a single character ('j', 'k', '/', '?') OR an array of them.
 *      Modifier-shortcuts (Cmd+K, Cmd+N) are handled by their own components.
 * fn: invoked with (event). Call event.preventDefault() if you want to swallow.
 * allowInInputs: when true, fires even if the user is typing.
 */
export function useShortcut(key, fn, opts = {}) {
  const keys = Array.isArray(key) ? key : [key];
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!opts.allowInInputs && isTyping(e.target)) return;
    if (keys.includes(e.key)) fn(e);
  }
  onMounted(() => document.addEventListener('keydown', onKey));
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
}
