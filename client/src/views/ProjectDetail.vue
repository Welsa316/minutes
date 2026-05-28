<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { projects, clients, meetings } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';
import SmartDateInput from '../components/SmartDateInput.vue';
import TagPicker from '../components/TagPicker.vue';
import PinButton from '../components/PinButton.vue';
import SaveStatus from '../components/SaveStatus.vue';
import { useRecent } from '../composables/useRecent.js';
import { useAutosave } from '../composables/useAutosave.js';
import { useToastStore } from '../stores/toast.js';
const recent = useRecent();
const toast = useToastStore();

const route = useRoute();
const router = useRouter();

const original = ref(null);
const draft = ref(null);
const budgetInput = ref('');
const clientOptions = ref([]);
const relatedMeetings = ref([]);
const loading = ref(true);

const autosave = useAutosave({
  data: draft,
  key: () => `project:${route.params.id}`,
  async save(snapshot) {
    const body = { ...snapshot };
    body.budget_cents = budgetInput.value ? Math.round(Number(budgetInput.value) * 100) : null;
    if (body.deadline === '') body.deadline = null;
    delete body.client_name; delete body.tags; delete body.created_at;
    const updated = await projects.update(route.params.id, body);
    original.value = updated;
  },
});

watch(budgetInput, () => {
  if (!draft.value) return;
  draft.value._budgetBump = (draft.value._budgetBump || 0) + 1;
});

async function load() {
  loading.value = true;
  const id = route.params.id;
  const [p, c, m] = await Promise.all([
    projects.get(id),
    clients.list(),
    meetings.list({ project_id: id }),
  ]);
  original.value = p;
  const stash = autosave.pickupDraft();
  if (stash?.payload && (Date.now() - stash.ts) < 24 * 60 * 60 * 1000) {
    const stashStr = JSON.stringify({ ...stash.payload, tags: undefined, client_name: undefined });
    const serverStr = JSON.stringify({ ...p, tags: undefined, client_name: undefined });
    if (stashStr !== serverStr && confirm(`Unsaved local edits from ${new Date(stash.ts).toLocaleString()}. Restore?`)) {
      draft.value = { ...p, ...stash.payload };
    } else {
      draft.value = { ...p };
      autosave.clearDraft();
    }
  } else {
    draft.value = { ...p };
  }
  budgetInput.value = p.budget_cents != null ? (p.budget_cents / 100).toString() : '';
  clientOptions.value = c;
  relatedMeetings.value = m;
  loading.value = false;
  autosave.seed();
  recent.visit({ kind: 'project', id: p.id, title: p.name });
}

async function destroy() {
  const name = original.value.name;
  await projects.remove(route.params.id);
  toast.show(`Deleted ${name}`, {
    kind: 'info', ttl: 6000,
    action: { label: 'Undo', run: async () => { await projects.restore(route.params.id); toast.success('Restored'); load(); } },
  });
  router.replace('/projects');
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ymd(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
  <div v-else-if="draft" class="max-w-4xl space-y-6">
    <header class="flex items-center gap-4">
      <RouterLink to="/projects" class="text-sm text-slate-warm hover:text-ink">&larr; Projects</RouterLink>
      <div class="flex-1" />
      <SaveStatus :status="autosave.status.value" :last-saved-at="autosave.lastSavedAt.value" />
      <PinButton entity-type="project" :entity-id="route.params.id" />
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <div class="space-y-4">
      <input
        v-model="draft.name"
        placeholder="Name"
        class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
      />

      <div class="flex items-center gap-3 flex-wrap text-sm">
        <StatusBadge :status="draft.status" variant="project" />
        <TagPicker entity-type="project" :entity-id="route.params.id" :initial="original.tags || []" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 card">
        <div>
          <label class="label" for="client">Client</label>
          <select id="client" v-model="draft.client_id" class="input">
            <option :value="null">—</option>
            <option v-for="c in clientOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="status">Status</label>
          <select id="status" v-model="draft.status" class="input">
            <option value="proposed">Proposed</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label class="label" for="deadline">Deadline</label>
          <SmartDateInput :model-value="draft.deadline" @update:model-value="draft.deadline = $event" mode="date" placeholder="next fri…" />
        </div>
        <div>
          <label class="label" for="budget">Budget ($)</label>
          <input id="budget" v-model="budgetInput" type="number" step="0.01" min="0" class="input" />
        </div>
        <div class="md:col-span-2">
          <label class="label" for="description">Description</label>
          <textarea id="description" v-model="draft.description" rows="4" class="input resize-y" />
        </div>
      </div>
    </div>

    <section v-if="relatedMeetings.length">
      <h2 class="font-serif text-lg text-ink mb-2">Meetings</h2>
      <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
        <li
          v-for="(m, idx) in relatedMeetings"
          :key="m.id"
          @click="router.push(`/meetings/${m.id}`)"
          :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60']"
        >
          <span class="flex-1 truncate">{{ m.title }}</span>
          <span class="text-xs text-slate-warm">{{ m.date ? fmtDate(m.date) : '—' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
