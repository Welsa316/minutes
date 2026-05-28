<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { clients as api } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';
import ClientChip from '../components/ClientChip.vue';
import TagChip from '../components/TagChip.vue';
import EmptyState from '../components/EmptyState.vue';
import { clientColor } from '../utils/colors.js';
import { useToastStore } from '../stores/toast.js';
import { useListNav } from '../composables/useListNav.js';

const toast = useToastStore();
const createInput = ref(null);

async function setStatus(client, status) {
  const prev = client.status;
  client.status = status;
  try { await api.update(client.id, { status }); }
  catch { client.status = prev; toast.error('Failed to update status'); }
}

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

const { selectedId } = useListNav({
  items: computed(() => items.value),
  pathFor: (c) => `/clients/${c.id}`,
  createInput,
});

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
        ref="createInput"
        v-model="newName"
        placeholder="New client name… (press c)"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <button type="submit" :disabled="!newName.trim() || creating" class="btn-primary text-sm">Add</button>
    </form>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <EmptyState
      v-else-if="!items.length"
      icon="◉"
      title="No clients yet"
      hint="Add the people and companies you're working with."
    />
    <ul v-else class="border border-sand rounded-lg overflow-hidden bg-surface">
      <li
        v-for="(c, idx) in items"
        :key="c.id"
        @click="router.push(`/clients/${c.id}`)"
        :class="['relative pl-4 pr-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4 transition-colors', idx > 0 && 'border-t border-sand/60', selectedId === c.id && 'bg-sand/30 ring-1 ring-inset ring-terracotta/30']"
      >
        <span
          aria-hidden
          class="absolute left-0 top-0 bottom-0 w-1"
          :style="{ background: clientColor(c.name).bg }"
        />
        <ClientChip :client="c" size="md" hide-label />
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">{{ c.name }}</div>
          <div class="flex items-center gap-2 flex-wrap text-sm text-slate-warm">
            <span v-if="c.company" class="truncate">{{ c.company }}</span>
            <TagChip v-for="t in c.tags" :key="t" :tag="t" size="xs" />
          </div>
        </div>
        <span v-if="c.source" class="text-xs text-slate-warm capitalize">{{ c.source }}</span>
        <StatusBadge :status="c.status" variant="client" editable @change="setStatus(c, $event)" />
      </li>
    </ul>
  </div>
</template>
