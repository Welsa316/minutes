<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { projects as api, clients as clientsApi } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';

const router = useRouter();
const items = ref([]);
const clientOptions = ref([]);
const loading = ref(true);
const newName = ref('');
const newClient = ref('');
const creating = ref(false);

async function load() {
  loading.value = true;
  const [p, c] = await Promise.all([api.list(), clientsApi.list()]);
  items.value = p;
  clientOptions.value = c;
  loading.value = false;
}

async function create() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    const p = await api.create({ name, client_id: newClient.value || null });
    newName.value = '';
    newClient.value = '';
    router.push(`/projects/${p.id}`);
  } finally {
    creating.value = false;
  }
}

function fmtDeadline(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl font-serif text-ink">Projects</h1>
      <span class="text-sm text-slate-warm">{{ items.length }}</span>
    </header>

    <form @submit.prevent="create" class="card flex items-center gap-3 py-2.5 px-4">
      <input
        v-model="newName"
        placeholder="New project name…"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <select v-model="newClient" class="text-sm bg-transparent text-slate-warm focus:outline-none">
        <option value="">No client</option>
        <option v-for="c in clientOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <button type="submit" :disabled="!newName.trim() || creating" class="btn-primary text-sm">Add</button>
    </form>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else-if="!items.length" class="text-sm text-slate-warm">No projects yet.</div>
    <ul v-else class="border border-sand rounded-lg overflow-hidden bg-warm">
      <li
        v-for="(p, idx) in items"
        :key="p.id"
        @click="router.push(`/projects/${p.id}`)"
        :class="['px-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60']"
      >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">{{ p.name }}</div>
          <div v-if="p.client_name" class="text-sm text-slate-warm truncate">{{ p.client_name }}</div>
        </div>
        <span v-if="p.deadline" class="text-xs text-slate-warm">{{ fmtDeadline(p.deadline) }}</span>
        <StatusBadge :status="p.status" variant="project" />
      </li>
    </ul>
  </div>
</template>
