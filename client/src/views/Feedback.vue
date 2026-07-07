<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { feedback as api, ideas as ideasApi, clients as clientsApi } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';
import ClientChip from '../components/ClientChip.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();

const items = ref([]);
const clientOptions = ref([]);
const loading = ref(true);
const filter = ref('all');

const newTitle = ref('');
const newSource = ref('other');
const newClient = ref('');
const creating = ref(false);
const createInput = ref(null);

const SOURCES = [
  { id: 'email', label: 'Email' },
  { id: 'dm', label: 'DM' },
  { id: 'support', label: 'Support' },
  { id: 'inapp', label: 'In-app' },
  { id: 'other', label: 'Other' },
];
const sourceLabel = (s) => SOURCES.find((x) => x.id === s)?.label || 'Other';

const FILTERS = ['all', 'new', 'triaged', 'planned', 'shipped', 'declined'];
const visible = computed(() =>
  filter.value === 'all' ? items.value : items.value.filter((f) => f.status === filter.value),
);
const openCount = computed(() => items.value.filter((f) => f.status === 'new').length);

async function load() {
  loading.value = true;
  const [f, c] = await Promise.all([api.list(), clientsApi.list()]);
  items.value = f;
  clientOptions.value = c;
  loading.value = false;
}

async function create() {
  const title = newTitle.value.trim();
  if (!title) return;
  creating.value = true;
  try {
    const row = await api.create({
      title,
      source: newSource.value,
      requester_client_id: newClient.value || null,
    });
    row.requester_name = clientOptions.value.find((c) => c.id === row.requester_client_id)?.name || null;
    items.value.unshift(row);
    newTitle.value = '';
    newClient.value = '';
    createInput.value?.focus();
  } finally {
    creating.value = false;
  }
}

async function setStatus(f, status) {
  const prev = f.status;
  f.status = status;
  try { await api.update(f.id, { status }); }
  catch { f.status = prev; toast.error('Failed to update status'); }
}

async function promote(f) {
  try {
    const idea = await ideasApi.create({ title: f.title, note: f.detail || null, lane: 'considering' });
    await api.update(f.id, { idea_id: idea.id, status: 'planned' });
    f.idea_id = idea.id;
    f.idea_title = idea.title;
    f.status = 'planned';
    toast.success('Added to roadmap');
  } catch { toast.error('Couldn’t add to roadmap'); }
}

async function destroy(f) {
  const idx = items.value.indexOf(f);
  if (idx > -1) items.value.splice(idx, 1);
  try {
    await api.remove(f.id);
    toast.show('Feedback deleted', {
      kind: 'info', ttl: 5000,
      action: { label: 'Undo', run: async () => { await api.restore(f.id); load(); } },
    });
  } catch { toast.error('Delete failed'); load(); }
}

function ago(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Feedback</h1>
      <span class="text-sm text-slate-warm">{{ openCount }} new · {{ items.length }} total</span>
    </header>

    <form @submit.prevent="create" class="card flex flex-wrap items-center gap-3 py-2.5 px-4">
      <input
        ref="createInput"
        v-model="newTitle"
        placeholder="Capture feedback… what did they say?"
        class="flex-1 min-w-[12rem] bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <select v-model="newSource" class="text-sm bg-transparent text-slate-warm focus:outline-none">
        <option v-for="s in SOURCES" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <select v-model="newClient" class="text-sm bg-transparent text-slate-warm focus:outline-none max-w-[9rem]">
        <option value="">No requester</option>
        <option v-for="c in clientOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <button type="submit" :disabled="!newTitle.trim() || creating" class="btn-primary text-sm">Add</button>
    </form>

    <div class="flex items-center gap-1 text-sm border-b border-sand/70 pb-2">
      <button
        v-for="f in FILTERS"
        :key="f"
        @click="filter = f"
        :class="['px-2.5 py-1 rounded capitalize', filter === f ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
      >{{ f }}</button>
    </div>

    <Skeleton v-if="loading" :rows="4" />

    <ul v-else-if="visible.length" class="border border-sand rounded-lg overflow-hidden bg-surface stagger">
      <li
        v-for="(f, idx) in visible"
        :key="f.id"
        :class="['group px-4 py-3 flex items-start gap-3', idx > 0 && 'border-t border-sand/60']"
      >
        <span class="mt-0.5 text-[10px] uppercase tracking-wide text-slate-warm w-14 shrink-0">{{ sourceLabel(f.source) }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-ink font-medium">{{ f.title }}</div>
          <p v-if="f.detail" class="text-sm text-slate-warm truncate">{{ f.detail }}</p>
          <div class="flex items-center gap-2 flex-wrap text-xs text-slate-warm mt-1">
            <ClientChip v-if="f.requester_name" :name="f.requester_name" :id="f.requester_client_id" size="sm" :hover="false" />
            <RouterLink v-if="f.idea_title" to="/roadmap" class="text-terracotta hover:underline truncate max-w-[12rem]">◈ {{ f.idea_title }}</RouterLink>
            <span>{{ ago(f.created_at) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <StatusBadge :status="f.status" variant="feedback" editable @change="setStatus(f, $event)" />
          <button
            v-if="!f.idea_id"
            @click="promote(f)"
            class="text-xs text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add to roadmap"
          >→ Roadmap</button>
          <button
            @click="destroy(f)"
            class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >✕</button>
        </div>
      </li>
    </ul>

    <EmptyState
      v-else
      icon="✉"
      title="No feedback yet"
      hint="Capture what users tell you, then send the good ideas to the roadmap."
    />
  </div>
</template>
