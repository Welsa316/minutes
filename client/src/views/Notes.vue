<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { notes as api } from '../api/endpoints.js';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import MicButton from '../components/MicButton.vue';
import { useListNav } from '../composables/useListNav.js';
import { exportNotesMarkdown } from '../utils/exportNote.js';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();
const exporting = ref(false);
const createInput = ref(null);

async function exportAll() {
  if (!filtered.value.length || exporting.value) return;
  exporting.value = true;
  const tid = toast.info('Exporting notes…', { ttl: 0 });
  try {
    // Fetch full bodies (the list payload already has body, but be safe).
    const full = await Promise.all(filtered.value.map((n) => api.get(n.id)));
    await exportNotesMarkdown(full);
    toast.dismiss(tid);
    toast.success(`Exported ${full.length} note${full.length === 1 ? '' : 's'}`);
  } catch {
    toast.dismiss(tid);
    toast.error('Export failed');
  } finally {
    exporting.value = false;
  }
}

const router = useRouter();
const items = ref([]);
const loading = ref(true);
const newTitle = ref('');
const creating = ref(false);
const activeTag = ref('');

const allTags = computed(() => {
  const s = new Set();
  for (const n of items.value) for (const t of n.tags || []) s.add(t);
  return [...s].sort();
});

const filtered = computed(() => {
  if (!activeTag.value) return items.value;
  return items.value.filter((n) => (n.tags || []).includes(activeTag.value));
});

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function create() {
  const title = newTitle.value.trim();
  if (!title) return;
  creating.value = true;
  try {
    const n = await api.create({ title });
    newTitle.value = '';
    router.push(`/notes/${n.id}`);
  } finally {
    creating.value = false;
  }
}

function stripHtml(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const { selectedId } = useListNav({
  items: computed(() => filtered.value),
  pathFor: (n) => `/notes/${n.id}`,
  createInput,
});

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between gap-3">
      <h1 class="text-3xl font-serif text-ink">Notes</h1>
      <div class="flex items-center gap-3">
        <button
          v-if="filtered.length"
          @click="exportAll"
          :disabled="exporting"
          class="text-sm text-slate-warm hover:text-ink disabled:opacity-50"
        >Export all</button>
        <span class="text-sm text-slate-warm tabular-nums">{{ items.length }}</span>
      </div>
    </header>

    <form @submit.prevent="create" class="card flex items-center gap-3 py-2.5 px-4">
      <input
        ref="createInput"
        v-model="newTitle"
        placeholder="New note title… (press c)"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <MicButton v-model="newTitle" mode="append" />
      <button type="submit" :disabled="!newTitle.trim() || creating" class="btn-primary text-sm">Add</button>
    </form>

    <div v-if="allTags.length" class="flex items-center gap-1 flex-wrap text-sm">
      <button @click="activeTag = ''" :class="['px-2.5 py-1 rounded', !activeTag ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">All</button>
      <button
        v-for="t in allTags"
        :key="t"
        @click="activeTag = t"
        :class="['px-2.5 py-1 rounded', activeTag === t ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
      >#{{ t }}</button>
    </div>

    <Skeleton v-if="loading" variant="cards" :rows="4" />
    <EmptyState
      v-else-if="!filtered.length"
      icon="✎"
      title="No notes"
      hint="Snippets, resources, brain-dumps. Anything that doesn't belong to a meeting."
    />
    <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
      <RouterLink
        v-for="n in filtered"
        :key="n.id"
        :to="`/notes/${n.id}`"
        custom
        v-slot="{ navigate }"
      >
      <li
        @click="navigate"
        :class="['card cursor-pointer hover:border-slate-warm/40 transition-colors block', selectedId === n.id && 'ring-1 ring-terracotta/40']"
      >
        <div class="font-medium text-ink truncate mb-1">{{ n.title }}</div>
        <p class="text-sm text-slate-warm line-clamp-3 mb-3">{{ stripHtml(n.body) || '—' }}</p>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-1 flex-wrap">
            <span v-for="t in n.tags" :key="t" class="text-xs px-1.5 py-0.5 rounded bg-sand text-ink">#{{ t }}</span>
          </div>
          <span class="text-xs text-slate-warm whitespace-nowrap">{{ fmtDate(n.created_at) }}</span>
        </div>
      </li>
      </RouterLink>
    </ul>
  </div>
</template>
