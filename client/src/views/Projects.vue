<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { VueDraggable } from 'vue-draggable-plus';
import { projects as api, clients as clientsApi } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';
import ClientChip from '../components/ClientChip.vue';
import TagChip from '../components/TagChip.vue';
import { useToastStore } from '../stores/toast.js';
import { clientColor } from '../utils/colors.js';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const items = ref([]);
const clientOptions = ref([]);
const loading = ref(true);
const newName = ref('');
const newClient = ref('');
const creating = ref(false);
const view = ref(route.query.view === 'kanban' ? 'kanban' : 'list');

const STATUSES = [
  { id: 'proposed', label: 'Proposed' },
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'done', label: 'Done' },
];

const byStatus = computed(() => {
  const groups = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
  for (const p of items.value) (groups[p.status] || groups.proposed).push(p);
  return groups;
});

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

async function setStatus(project, status) {
  const prev = project.status;
  project.status = status;
  try { await api.update(project.id, { status }); }
  catch { project.status = prev; toast.error('Failed to update status'); }
}

async function onDragEnd(status) {
  // After a drag, the kanban column for `status` may contain a project that came from another column.
  // We need to figure out which project changed status and persist it.
  const inColumn = byStatus.value[status];
  for (const p of inColumn) {
    if (p.status !== status) {
      const optimisticPrev = p.status;
      p.status = status;
      try {
        await api.update(p.id, { status });
      } catch {
        p.status = optimisticPrev;
        toast.error('Failed to update status');
      }
    }
  }
}

function fmtDeadline(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

watch(view, (v) => {
  router.replace({ query: { ...route.query, view: v === 'kanban' ? 'kanban' : undefined } });
});

onMounted(load);
</script>

<template>
  <div :class="['space-y-5', view === 'kanban' ? 'max-w-none' : 'max-w-4xl']">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Projects</h1>
      <div class="flex items-center gap-1 text-sm">
        <button @click="view = 'list'" :class="['px-2.5 py-1 rounded', view === 'list' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">List</button>
        <button @click="view = 'kanban'" :class="['px-2.5 py-1 rounded', view === 'kanban' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Kanban</button>
        <span class="ml-3 text-sm text-slate-warm">{{ items.length }}</span>
      </div>
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

    <!-- List view -->
    <ul v-else-if="view === 'list' && items.length" class="border border-sand rounded-lg overflow-hidden bg-warm">
      <li
        v-for="(p, idx) in items"
        :key="p.id"
        @click="router.push(`/projects/${p.id}`)"
        :class="['relative pl-4 pr-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60']"
      >
        <span v-if="p.client_name" aria-hidden class="absolute left-0 top-0 bottom-0 w-1" :style="{ background: clientColor(p.client_name).bg }" />
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">{{ p.name }}</div>
          <div class="flex items-center gap-2 flex-wrap text-sm text-slate-warm">
            <ClientChip v-if="p.client_name" :name="p.client_name" :id="p.client_id" size="sm" />
            <TagChip v-for="t in p.tags" :key="t" :tag="t" size="xs" />
          </div>
        </div>
        <span v-if="p.deadline" class="text-xs text-slate-warm">{{ fmtDeadline(p.deadline) }}</span>
        <StatusBadge :status="p.status" variant="project" editable @change="setStatus(p, $event)" />
      </li>
    </ul>
    <p v-else-if="view === 'list'" class="text-sm text-slate-warm">No projects yet.</p>

    <!-- Kanban view -->
    <div v-if="view === 'kanban' && !loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="col in STATUSES" :key="col.id" class="bg-sand/30 rounded-lg p-2 min-h-[12rem]">
        <div class="flex items-center justify-between px-2 py-1.5 mb-1">
          <h3 class="font-medium text-sm text-ink">{{ col.label }}</h3>
          <span class="text-xs text-slate-warm">{{ byStatus[col.id].length }}</span>
        </div>
        <VueDraggable
          :model-value="byStatus[col.id]"
          group="projects"
          item-key="id"
          ghost-class="opacity-30"
          animation="180"
          class="space-y-2 min-h-[4rem]"
          @end="onDragEnd(col.id)"
        >
          <div
            v-for="p in byStatus[col.id]"
            :key="p.id"
            @click="router.push(`/projects/${p.id}`)"
            class="bg-warm border border-sand rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-warm/40 hover:shadow-sm transition-shadow group"
          >
            <div class="flex items-start gap-2">
              <span
                v-if="p.client_name"
                aria-hidden
                class="w-1 self-stretch rounded shrink-0"
                :style="{ background: clientColor(p.client_name).bg }"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-ink truncate">{{ p.name }}</div>
                <div v-if="p.client_name" class="text-xs text-slate-warm truncate">{{ p.client_name }}</div>
                <div v-if="p.tags?.length" class="flex items-center gap-1 flex-wrap mt-1.5">
                  <TagChip v-for="t in p.tags" :key="t" :tag="t" size="xs" />
                </div>
                <div v-if="p.deadline" class="text-[10px] text-slate-warm mt-1.5">{{ fmtDeadline(p.deadline) }}</div>
              </div>
            </div>
          </div>
        </VueDraggable>
      </div>
    </div>
  </div>
</template>
