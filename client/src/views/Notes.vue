<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { notes as api } from '../api/endpoints.js';

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

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl font-serif text-ink">Notes</h1>
      <span class="text-sm text-slate-warm">{{ items.length }}</span>
    </header>

    <form @submit.prevent="create" class="card flex items-center gap-3 py-2.5 px-4">
      <input
        v-model="newTitle"
        placeholder="New note title…"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
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

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else-if="!filtered.length" class="text-sm text-slate-warm">No notes.</div>
    <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <li
        v-for="n in filtered"
        :key="n.id"
        @click="router.push(`/notes/${n.id}`)"
        class="card cursor-pointer hover:border-slate-warm/40 transition-colors"
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
    </ul>
  </div>
</template>
