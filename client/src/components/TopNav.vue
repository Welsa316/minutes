<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { search } from '../api/endpoints.js';
import { useShortcut, isTyping } from '../composables/useShortcuts.js';
import { useUiStore } from '../stores/ui.js';

const router = useRouter();
const ui = useUiStore();
const q = ref('');
const results = ref(null);
const open = ref(false);
const loading = ref(false);
const wrapper = ref(null);
const inputEl = ref(null);
let debounce;

// `/` focuses the search box
useShortcut('/', (e) => {
  e.preventDefault();
  inputEl.value?.focus();
});

watch(q, (val) => {
  clearTimeout(debounce);
  if (val.trim().length < 2) {
    results.value = null;
    return;
  }
  loading.value = true;
  debounce = setTimeout(async () => {
    try {
      results.value = await search(val);
      open.value = true;
    } finally {
      loading.value = false;
    }
  }, 200);
});

function go(path) {
  open.value = false;
  q.value = '';
  results.value = null;
  router.push(path);
}

function onDocClick(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) open.value = false;
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<template>
  <header class="h-16 border-b border-sand bg-warm flex items-center px-4 sm:px-6 lg:px-8 gap-2 sm:gap-4 sticky top-0 z-10">
    <button
      class="lg:hidden btn-ghost px-2.5 -ml-1 shrink-0 h-10"
      @click="ui.toggleSidebar()"
      title="Menu"
      aria-label="Open menu"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
    </button>
    <div ref="wrapper" class="relative flex-1 max-w-xl">
      <input
        ref="inputEl"
        v-model="q"
        @focus="results && (open = true)"
        type="search"
        placeholder="Search…"
        class="input pl-9"
      />
      <svg
        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-warm pointer-events-none"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <div
        v-if="open && results"
        class="absolute left-0 right-0 mt-1 bg-surface border border-sand rounded-md shadow-lg max-h-[28rem] overflow-y-auto z-20"
      >
        <p v-if="loading" class="px-3 py-2 text-sm text-slate-warm">Searching…</p>
        <template v-else-if="results.meetings.length || results.clients.length || results.projects.length || results.notes.length">
          <div v-if="results.meetings.length">
            <div class="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-warm">Meetings</div>
            <button
              v-for="m in results.meetings"
              :key="`m-${m.id}`"
              @click="go(`/meetings/${m.id}`)"
              class="w-full text-left px-3 py-2 hover:bg-sand/50 text-sm flex items-center gap-2"
            >
              <span class="flex-1 truncate text-ink">{{ m.title }}</span>
              <span class="text-xs text-slate-warm">{{ fmtDate(m.date) }}</span>
            </button>
          </div>
          <div v-if="results.clients.length">
            <div class="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-warm">Clients</div>
            <button
              v-for="c in results.clients"
              :key="`c-${c.id}`"
              @click="go(`/clients/${c.id}`)"
              class="w-full text-left px-3 py-2 hover:bg-sand/50 text-sm"
            >
              <span class="text-ink">{{ c.name }}</span>
              <span v-if="c.company" class="text-slate-warm"> · {{ c.company }}</span>
            </button>
          </div>
          <div v-if="results.projects.length">
            <div class="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-warm">Projects</div>
            <button
              v-for="p in results.projects"
              :key="`p-${p.id}`"
              @click="go(`/projects/${p.id}`)"
              class="w-full text-left px-3 py-2 hover:bg-sand/50 text-sm text-ink"
            >{{ p.name }}</button>
          </div>
          <div v-if="results.notes.length">
            <div class="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-warm">Notes</div>
            <button
              v-for="n in results.notes"
              :key="`n-${n.id}`"
              @click="go(`/notes/${n.id}`)"
              class="w-full text-left px-3 py-2 hover:bg-sand/50 text-sm text-ink"
            >{{ n.title }}</button>
          </div>
        </template>
        <p v-else class="px-3 py-2 text-sm text-slate-warm">No matches.</p>
      </div>
    </div>
  </header>
</template>
