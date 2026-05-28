<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { search } from '../api/endpoints.js';

const router = useRouter();
const open = ref(false);
const q = ref('');
const results = ref(null);
const cursor = ref(0);
const inputEl = ref(null);
let debounce;

const ACTIONS = [
  { label: 'New meeting',  hint: 'Cmd+N', shortcut: 'meeting-new', icon: '+', run: () => router.push('/meetings/new') },
  { label: 'Dashboard',    path: '/' },
  { label: 'Clients',      path: '/clients' },
  { label: 'Projects',     path: '/projects' },
  { label: 'Meetings',     path: '/meetings' },
  { label: 'Notes',        path: '/notes' },
  { label: 'Tags',         path: '/tags' },
  { label: 'Calendar',     path: '/calendar' },
  { label: 'Kanban',       path: '/projects?view=kanban' },
];

const filteredActions = computed(() => {
  const text = q.value.trim().toLowerCase();
  if (!text) return ACTIONS;
  return ACTIONS.filter((a) => a.label.toLowerCase().includes(text));
});

const flat = computed(() => {
  const arr = [];
  if (filteredActions.value.length) arr.push({ header: 'Actions' });
  for (const a of filteredActions.value) arr.push({ kind: 'action', ...a });
  if (results.value) {
    if (results.value.clients.length) {
      arr.push({ header: 'Clients' });
      for (const c of results.value.clients) arr.push({ kind: 'client', ...c });
    }
    if (results.value.projects.length) {
      arr.push({ header: 'Projects' });
      for (const p of results.value.projects) arr.push({ kind: 'project', ...p });
    }
    if (results.value.meetings.length) {
      arr.push({ header: 'Meetings' });
      for (const m of results.value.meetings) arr.push({ kind: 'meeting', ...m });
    }
    if (results.value.notes.length) {
      arr.push({ header: 'Notes' });
      for (const n of results.value.notes) arr.push({ kind: 'note', ...n });
    }
  }
  return arr;
});

const selectable = computed(() => flat.value.filter((r) => !r.header));

function show() {
  open.value = true;
  q.value = '';
  results.value = null;
  cursor.value = 0;
  nextTick(() => inputEl.value?.focus());
}

function hide() {
  open.value = false;
}

watch(q, (val) => {
  clearTimeout(debounce);
  cursor.value = 0;
  if (val.trim().length < 2) {
    results.value = null;
    return;
  }
  debounce = setTimeout(async () => {
    try { results.value = await search(val); } catch {}
  }, 150);
});

function pick(item) {
  if (item.kind === 'action') {
    if (item.run) item.run();
    else if (item.path) router.push(item.path);
  } else if (item.kind === 'client') router.push(`/clients/${item.id}`);
  else if (item.kind === 'project') router.push(`/projects/${item.id}`);
  else if (item.kind === 'meeting') router.push(`/meetings/${item.id}`);
  else if (item.kind === 'note') router.push(`/notes/${item.id}`);
  hide();
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    open.value ? hide() : show();
    return;
  }
  if (!open.value) return;
  if (e.key === 'Escape') { e.preventDefault(); hide(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor.value = Math.min(cursor.value + 1, selectable.value.length - 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); cursor.value = Math.max(cursor.value - 1, 0); }
  if (e.key === 'Enter') { e.preventDefault(); const item = selectable.value[cursor.value]; if (item) pick(item); }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

function isCursor(item) {
  return selectable.value.indexOf(item) === cursor.value;
}

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <Transition name="cp">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
        @mousedown.self="hide"
      >
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="hide" />
        <div class="relative w-full max-w-xl bg-warm border border-sand rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
          <div class="px-4 py-3 border-b border-sand flex items-center gap-3">
            <svg class="h-4 w-4 text-slate-warm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              ref="inputEl"
              v-model="q"
              placeholder="Search anything or pick an action…"
              class="flex-1 bg-transparent text-base focus:outline-none placeholder-slate-warm/60"
            />
            <kbd class="text-[10px] text-slate-warm border border-sand rounded px-1.5 py-0.5">esc</kbd>
          </div>

          <div class="overflow-y-auto flex-1">
            <template v-for="(item, idx) in flat" :key="idx">
              <div v-if="item.header" class="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-slate-warm">{{ item.header }}</div>
              <button
                v-else
                type="button"
                @click="pick(item)"
                @mousemove="cursor = selectable.indexOf(item)"
                :class="[
                  'w-full px-3 py-2 text-left flex items-center gap-3 text-sm transition-colors',
                  isCursor(item) ? 'bg-sand text-ink' : 'text-ink hover:bg-sand/40'
                ]"
              >
                <span class="text-slate-warm w-4 text-center text-base leading-none">{{ item.icon || (item.kind === 'client' ? '◉' : item.kind === 'project' ? '▤' : item.kind === 'meeting' ? '◷' : item.kind === 'note' ? '✎' : '›') }}</span>
                <span class="flex-1 truncate">
                  {{ item.label || item.name || item.title }}
                  <span v-if="item.company" class="text-slate-warm"> · {{ item.company }}</span>
                </span>
                <span v-if="item.hint" class="text-xs text-slate-warm">{{ item.hint }}</span>
              </button>
            </template>
            <p v-if="!flat.length" class="px-4 py-4 text-sm text-slate-warm">No matches.</p>
          </div>

          <div class="px-3 py-2 border-t border-sand text-[11px] text-slate-warm flex items-center gap-3">
            <span><kbd class="border border-sand rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd class="border border-sand rounded px-1">↵</kbd> open</span>
            <span class="ml-auto">Cmd+K to toggle</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cp-enter-active, .cp-leave-active {
  transition: opacity 180ms ease;
}
.cp-enter-active > div.relative,
.cp-leave-active > div.relative {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.cp-enter-from > div.relative {
  transform: translateY(-8px) scale(0.98);
  opacity: 0;
}
.cp-leave-to > div.relative {
  transform: translateY(-6px) scale(0.99);
  opacity: 0;
}
.cp-enter-from, .cp-leave-to { opacity: 0; }
</style>
