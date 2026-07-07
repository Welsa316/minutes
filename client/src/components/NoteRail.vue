<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useNotesStore } from '../stores/notes.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { COVERS } from '../utils/noteCovers.js';
import Skeleton from './Skeleton.vue';

const store = useNotesStore();
const ws = useWorkspaceStore();
const router = useRouter();
const route = useRoute();

const search = ref('');
const creating = ref(false);
const SORTS = [['edited', 'Edited'], ['created', 'Created'], ['title', 'Title']];

onMounted(() => store.ensure(ws.activeId));
watch(() => ws.activeId, (id) => store.ensure(id, true));

const activeId = computed(() => (route.params.id ? Number(route.params.id) : null));

function stripHtml(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

function edited(n) {
  const d = new Date(n.updated_at || n.created_at);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.list;
  return store.list.filter(
    (n) => (n.title || '').toLowerCase().includes(q) || stripHtml(n.body).toLowerCase().includes(q),
  );
});

const pinned = computed(() => filtered.value.filter((n) => n.pinned));

const sorted = computed(() => {
  const arr = filtered.value.filter((n) => !n.pinned);
  const key = store.sort;
  arr.sort((a, b) => {
    if (key === 'title') return (a.title || '').localeCompare(b.title || '');
    if (key === 'created') return new Date(b.created_at) - new Date(a.created_at);
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });
  return arr;
});

// Date-bucketed groups (Apple Notes style) for edited/created sort; flat for title.
const groups = computed(() => {
  if (store.sort === 'title') return [{ label: '', items: sorted.value }];
  const dateOf = (n) => new Date(store.sort === 'created' ? n.created_at : (n.updated_at || n.created_at)).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d7 = startToday - 6 * 864e5;
  const d30 = startToday - 29 * 864e5;
  const b = { Today: [], 'Previous 7 days': [], 'Previous 30 days': [], Older: [] };
  for (const n of sorted.value) {
    const t = dateOf(n);
    if (t >= startToday) b.Today.push(n);
    else if (t >= d7) b['Previous 7 days'].push(n);
    else if (t >= d30) b['Previous 30 days'].push(n);
    else b.Older.push(n);
  }
  return Object.entries(b).filter(([, v]) => v.length).map(([label, items]) => ({ label, items }));
});

async function newNote() {
  if (creating.value) return;
  creating.value = true;
  try {
    const n = await store.create();
    router.push(`/notes/${n.id}`);
  } finally { creating.value = false; }
}

function open(n) { router.push(`/notes/${n.id}`); }
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- controls -->
    <div class="px-3 pt-3 pb-2 space-y-2 shrink-0">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-warm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            v-model="search"
            placeholder="Search notes"
            class="w-full text-sm bg-sand/40 rounded-md pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-terracotta/40 placeholder-slate-warm/70"
          />
        </div>
        <button
          @click="newNote"
          :disabled="creating"
          class="h-8 w-8 grid place-items-center rounded-md bg-terracotta text-white hover:brightness-105 shrink-0 disabled:opacity-60"
          title="New note (creates a blank note)"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <div class="flex items-center gap-1 text-xs">
        <button
          v-for="[key, label] in SORTS"
          :key="key"
          @click="store.setSort(key)"
          :class="['px-2 py-0.5 rounded transition-colors', store.sort === key ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
        >{{ label }}</button>
      </div>
    </div>

    <!-- list -->
    <div class="flex-1 overflow-y-auto px-2 pb-4">
      <Skeleton v-if="store.loading && !store.list.length" variant="list" :rows="6" />

      <div v-else-if="!filtered.length" class="text-center text-sm text-slate-warm py-10 px-4">
        {{ search ? 'No notes match.' : 'No notes yet.' }}
      </div>

      <template v-else>
        <!-- Pinned -->
        <div v-if="pinned.length" class="mb-2">
          <p class="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-slate-warm font-medium flex items-center gap-1">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v6l3 3v2h-4v5l-1 1-1-1v-5H6v-2l3-3V4z"/></svg>
            Pinned
          </p>
          <button
            v-for="n in pinned"
            :key="n.id"
            @click="open(n)"
            :class="['note-row', activeId === n.id && 'note-row-active']"
          >
            <span class="row-accent" :style="n.cover ? { backgroundImage: COVERS[n.cover] } : null" />
            <span class="ic">{{ n.icon || '📝' }}</span>
            <span class="min-w-0 flex-1">
              <span class="row-title">{{ n.title || 'Untitled' }}</span>
              <span class="row-preview">{{ n.layout === 'board' ? 'Board' : (stripHtml(n.body) || 'Empty note') }}</span>
              <span class="row-meta">{{ edited(n) }}<template v-if="n.layout === 'board'"> · ▦</template><template v-for="t in (n.universal_tags || []).slice(0,2)" :key="t"> · #{{ t }}</template></span>
            </span>
          </button>
        </div>

        <!-- Groups -->
        <div v-for="g in groups" :key="g.label" class="mb-1">
          <p v-if="g.label" class="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-warm font-medium">{{ g.label }}</p>
          <button
            v-for="n in g.items"
            :key="n.id"
            @click="open(n)"
            :class="['note-row', activeId === n.id && 'note-row-active']"
          >
            <span class="row-accent" :style="n.cover ? { backgroundImage: COVERS[n.cover] } : null" />
            <span class="ic">{{ n.icon || '📝' }}</span>
            <span class="min-w-0 flex-1">
              <span class="row-title">{{ n.title || 'Untitled' }}</span>
              <span class="row-preview">{{ n.layout === 'board' ? 'Board' : (stripHtml(n.body) || 'Empty note') }}</span>
              <span class="row-meta">{{ edited(n) }}<template v-if="n.layout === 'board'"> · ▦</template><template v-for="t in (n.universal_tags || []).slice(0,2)" :key="t"> · #{{ t }}</template></span>
            </span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.note-row {
  position: relative;
  display: flex; align-items: flex-start; gap: 0.6rem;
  width: 100%; text-align: left;
  padding: 0.55rem 0.6rem 0.55rem 0.7rem;
  border-radius: 0.6rem;
  transition: background 0.15s;
}
.note-row:hover { background: rgb(var(--c-sand) / 0.45); }
.note-row-active { background: rgb(var(--c-terracotta) / 0.12); }
.note-row-active:hover { background: rgb(var(--c-terracotta) / 0.15); }
.row-accent {
  position: absolute; left: 0; top: 0.5rem; bottom: 0.5rem; width: 3px;
  border-radius: 3px; background: transparent;
}
.ic { font-size: 1.05rem; line-height: 1.4; flex-shrink: 0; width: 1.3rem; text-align: center; }
.row-title {
  display: block; font-family: theme('fontFamily.serif');
  color: rgb(var(--c-ink)); font-size: 0.94rem; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.row-preview {
  display: block; color: rgb(var(--c-slate-warm)); font-size: 0.8rem; line-height: 1.3;
  margin-top: 0.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.row-meta {
  display: block; color: rgb(var(--c-slate-warm) / 0.85); font-size: 0.7rem;
  margin-top: 0.12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
