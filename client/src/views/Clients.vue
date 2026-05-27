<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { clients as api } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';

const router = useRouter();
const items = ref([]);
const loading = ref(true);
const newName = ref('');
const creating = ref(false);

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function create() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    const c = await api.create({ name });
    newName.value = '';
    router.push(`/clients/${c.id}`);
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl font-serif text-ink">Clients</h1>
      <span class="text-sm text-slate-warm">{{ items.length }}</span>
    </header>

    <form @submit.prevent="create" class="card flex items-center gap-3 py-2.5 px-4">
      <input
        v-model="newName"
        placeholder="New client name…"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <button type="submit" :disabled="!newName.trim() || creating" class="btn-primary text-sm">Add</button>
    </form>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else-if="!items.length" class="text-sm text-slate-warm">No clients yet.</div>
    <ul v-else class="border border-sand rounded-lg overflow-hidden bg-warm">
      <li
        v-for="(c, idx) in items"
        :key="c.id"
        @click="router.push(`/clients/${c.id}`)"
        :class="['px-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4 transition-colors', idx > 0 && 'border-t border-sand/60']"
      >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">{{ c.name }}</div>
          <div v-if="c.company" class="text-sm text-slate-warm truncate">{{ c.company }}</div>
        </div>
        <span v-if="c.source" class="text-xs text-slate-warm capitalize">{{ c.source }}</span>
        <StatusBadge :status="c.status" variant="client" />
      </li>
    </ul>
  </div>
</template>
