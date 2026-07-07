<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { ideas as api, projects as projectsApi } from '../api/endpoints.js';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const editing = ref(null);
const draft = reactive({ title: '', note: '', effort: '', lane: 'considering' });
const quick = reactive({});

const LANES = [
  { id: 'someday', label: 'Someday' },
  { id: 'considering', label: 'Considering' },
  { id: 'next', label: 'Next' },
  { id: 'building', label: 'Building' },
  { id: 'shipped', label: 'Shipped' },
];
const EFFORTS = [{ id: '', label: '—' }, { id: 's', label: 'S' }, { id: 'm', label: 'M' }, { id: 'l', label: 'L' }];

const byLane = computed(() => {
  const groups = Object.fromEntries(LANES.map((l) => [l.id, []]));
  for (const i of items.value) (groups[i.lane] || groups.considering).push(i);
  return groups;
});

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function addTo(laneId) {
  const title = (quick[laneId] || '').trim();
  if (!title) return;
  const row = await api.create({ title, lane: laneId });
  row.demand = 0;
  items.value.push(row);
  quick[laneId] = '';
}

// After a drag, the target lane may hold a card whose lane field is still stale —
// find it and persist the new lane. (Mirrors the Projects kanban pattern.)
async function onDragEnd(laneId) {
  for (const i of byLane.value[laneId]) {
    if (i.lane !== laneId) {
      const prev = i.lane;
      i.lane = laneId;
      try { await api.update(i.id, { lane: laneId }); }
      catch { i.lane = prev; toast.error('Failed to move'); }
    }
  }
}

function openEdit(idea) {
  editing.value = idea;
  draft.title = idea.title;
  draft.note = idea.note || '';
  draft.effort = idea.effort || '';
  draft.lane = idea.lane;
}

async function saveEdit() {
  const idea = editing.value;
  if (!idea) return;
  const title = draft.title.trim();
  if (!title) return;
  try {
    const updated = await api.update(idea.id, {
      title, note: draft.note || null, effort: draft.effort || null, lane: draft.lane,
    });
    Object.assign(idea, { title: updated.title, note: updated.note, effort: updated.effort, lane: updated.lane });
    editing.value = null;
  } catch { toast.error('Save failed'); }
}

async function destroy() {
  const idea = editing.value;
  if (!idea) return;
  const idx = items.value.indexOf(idea);
  if (idx > -1) items.value.splice(idx, 1);
  editing.value = null;
  try {
    await api.remove(idea.id);
    toast.show('Idea deleted', {
      kind: 'info', ttl: 5000,
      action: { label: 'Undo', run: async () => { await api.restore(idea.id); load(); } },
    });
  } catch { toast.error('Delete failed'); load(); }
}

async function convert() {
  const idea = editing.value;
  if (!idea || idea.project_id) return;
  try {
    const p = await projectsApi.create({ name: idea.title });
    const updated = await api.update(idea.id, { project_id: p.id, lane: 'building' });
    Object.assign(idea, { project_id: p.id, lane: updated.lane });
    editing.value = null;
    toast.success('Project created');
  } catch { toast.error('Couldn’t create project'); }
}

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Roadmap</h1>
      <span class="text-sm text-slate-warm">{{ items.length }} idea{{ items.length === 1 ? '' : 's' }}</span>
    </header>

    <Skeleton v-if="loading" :rows="4" />
    <EmptyState
      v-else-if="!items.length"
      icon="◈"
      title="Nothing on the roadmap"
      hint="Park ideas in a lane, drag them toward Building, and ship."
    />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
      <div v-for="lane in LANES" :key="lane.id" class="bg-sand/30 rounded-lg p-2">
        <div class="flex items-center justify-between px-2 py-1.5 mb-1">
          <h3 class="font-medium text-sm text-ink">{{ lane.label }}</h3>
          <span class="text-xs text-slate-warm">{{ byLane[lane.id].length }}</span>
        </div>
        <VueDraggable
          :model-value="byLane[lane.id]"
          group="ideas"
          item-key="id"
          ghost-class="opacity-30"
          animation="180"
          class="space-y-2 min-h-[3rem]"
          @end="onDragEnd(lane.id)"
        >
          <div
            v-for="i in byLane[lane.id]"
            :key="i.id"
            @click="openEdit(i)"
            class="bg-surface border border-sand rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-warm/40 hover:shadow-sm transition-shadow"
          >
            <div class="text-sm text-ink leading-snug">{{ i.title }}</div>
            <div class="flex items-center gap-2 mt-1.5 text-[11px] text-slate-warm">
              <span v-if="i.effort" class="uppercase font-medium bg-sand rounded px-1">{{ i.effort }}</span>
              <span v-if="Number(i.demand) > 0" class="text-terracotta" title="requests from feedback">🔥 {{ i.demand }}</span>
              <span v-if="i.project_id" title="linked project">▤</span>
            </div>
          </div>
        </VueDraggable>
        <form @submit.prevent="addTo(lane.id)" class="mt-2">
          <input
            v-model="quick[lane.id]"
            placeholder="+ add"
            class="w-full text-sm bg-transparent px-2 py-1 rounded placeholder-slate-warm/60 focus:outline-none focus:bg-surface/70"
          />
        </form>
      </div>
    </div>

    <!-- Edit modal -->
    <Teleport to="body">
      <div v-if="editing" class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" @mousedown.self="editing = null">
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="editing = null" />
        <div class="relative w-full max-w-md bg-surface border border-sand rounded-xl shadow-2xl p-5 space-y-4">
          <input
            v-model="draft.title"
            class="w-full text-lg font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
            placeholder="Idea"
            @keydown.enter.prevent="saveEdit"
          />
          <textarea
            v-model="draft.note"
            rows="3"
            placeholder="Notes…"
            class="w-full text-sm text-ink bg-transparent border border-sand rounded-md px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40 resize-none"
          />
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <span class="text-xs text-slate-warm mr-1">Effort</span>
              <button
                v-for="e in EFFORTS"
                :key="e.id"
                type="button"
                @click="draft.effort = e.id"
                :class="['h-6 min-w-[1.5rem] px-1 rounded text-xs', draft.effort === e.id ? 'bg-terracotta text-white' : 'bg-sand text-slate-warm hover:text-ink']"
              >{{ e.label }}</button>
            </div>
            <label class="flex items-center gap-1 text-xs text-slate-warm">
              Lane
              <select v-model="draft.lane" class="bg-transparent text-ink text-sm focus:outline-none">
                <option v-for="l in LANES" :key="l.id" :value="l.id">{{ l.label }}</option>
              </select>
            </label>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-sand">
            <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
            <div class="flex items-center gap-2">
              <button
                v-if="!editing.project_id"
                @click="convert"
                class="text-sm text-slate-warm hover:text-ink"
                title="Create a project from this idea"
              >→ Project</button>
              <button @click="saveEdit" class="btn-primary text-sm">Done</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
