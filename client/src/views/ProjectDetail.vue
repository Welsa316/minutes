<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { projects, clients, meetings } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';

const route = useRoute();
const router = useRouter();

const original = ref(null);
const draft = ref(null);
const budgetInput = ref('');
const clientOptions = ref([]);
const relatedMeetings = ref([]);
const loading = ref(true);
const saving = ref(false);

const dirty = computed(() => {
  if (!original.value || !draft.value) return false;
  const cents = budgetInput.value ? Math.round(Number(budgetInput.value) * 100) : null;
  return (
    JSON.stringify({ ...original.value, budget_cents: original.value.budget_cents }) !==
    JSON.stringify({ ...draft.value, budget_cents: cents })
  );
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
  draft.value = { ...p };
  budgetInput.value = p.budget_cents != null ? (p.budget_cents / 100).toString() : '';
  clientOptions.value = c;
  relatedMeetings.value = m;
  loading.value = false;
}

async function save() {
  saving.value = true;
  try {
    const body = { ...draft.value };
    body.budget_cents = budgetInput.value ? Math.round(Number(budgetInput.value) * 100) : null;
    if (body.deadline === '') body.deadline = null;
    const updated = await projects.update(route.params.id, body);
    original.value = updated;
    draft.value = { ...updated };
    budgetInput.value = updated.budget_cents != null ? (updated.budget_cents / 100).toString() : '';
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  if (!confirm(`Delete ${original.value.name}? This cannot be undone.`)) return;
  await projects.remove(route.params.id);
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
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
      <button @click="save" :disabled="!dirty || saving" class="btn-primary text-sm">
        {{ saving ? 'Saving…' : dirty ? 'Save' : 'Saved' }}
      </button>
    </header>

    <div class="space-y-4">
      <input
        v-model="draft.name"
        placeholder="Name"
        class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
      />

      <div class="flex items-center gap-3 flex-wrap text-sm">
        <StatusBadge :status="draft.status" variant="project" />
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
          <input id="deadline" type="date" :value="ymd(draft.deadline)" @change="draft.deadline = $event.target.value || null" class="input" />
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
      <ul class="border border-sand rounded-lg overflow-hidden bg-warm">
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
