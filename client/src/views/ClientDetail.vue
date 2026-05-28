<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { clients, projects, meetings } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';
import StatusBadge from '../components/StatusBadge.vue';
import TagPicker from '../components/TagPicker.vue';
import ClientChip from '../components/ClientChip.vue';
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
const relatedProjects = ref([]);
const relatedMeetings = ref([]);
const loading = ref(true);

const autosave = useAutosave({
  data: draft,
  key: () => `client:${route.params.id}`,
  async save(snapshot) {
    const body = { ...snapshot };
    delete body.tags; delete body.created_at;
    const updated = await clients.update(route.params.id, body);
    original.value = updated;
  },
});

async function load() {
  loading.value = true;
  const id = route.params.id;
  const [c, p, m] = await Promise.all([
    clients.get(id),
    projects.list({ client_id: id }),
    meetings.list({ client_id: id }),
  ]);
  original.value = c;
  const stash = autosave.pickupDraft();
  if (stash?.payload && (Date.now() - stash.ts) < 24 * 60 * 60 * 1000) {
    const stashStr = JSON.stringify({ ...stash.payload, tags: undefined });
    const serverStr = JSON.stringify({ ...c, tags: undefined });
    if (stashStr !== serverStr && confirm(`Unsaved local edits from ${new Date(stash.ts).toLocaleString()}. Restore?`)) {
      draft.value = { ...c, ...stash.payload };
    } else {
      draft.value = { ...c };
      autosave.clearDraft();
    }
  } else {
    draft.value = { ...c };
  }
  relatedProjects.value = p;
  relatedMeetings.value = m;
  loading.value = false;
  autosave.seed();
  recent.visit({ kind: 'client', id: c.id, title: c.name });
}

async function destroy() {
  const name = original.value.name;
  await clients.remove(route.params.id);
  toast.show(`Deleted ${name}`, {
    kind: 'info', ttl: 6000,
    action: { label: 'Undo', run: async () => { await clients.restore(route.params.id); toast.success('Restored'); load(); } },
  });
  router.replace('/clients');
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
  <div v-else-if="draft" class="max-w-4xl space-y-6">
    <header class="flex items-center gap-4">
      <RouterLink to="/clients" class="text-sm text-slate-warm hover:text-ink">&larr; Clients</RouterLink>
      <div class="flex-1" />
      <SaveStatus :status="autosave.status.value" :last-saved-at="autosave.lastSavedAt.value" />
      <PinButton entity-type="client" :entity-id="route.params.id" />
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <div class="space-y-4">
      <input
        v-model="draft.name"
        placeholder="Name"
        class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
      />

      <div class="flex items-center gap-3 flex-wrap text-sm">
        <ClientChip :client="original" size="md" hide-label />
        <StatusBadge :status="draft.status" variant="client" />
        <TagPicker entity-type="client" :entity-id="route.params.id" :initial="original.tags || []" />
        <span class="text-slate-warm ml-auto">Added {{ fmtDate(original.created_at) }}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 card">
        <div>
          <label class="label" for="company">Company</label>
          <input id="company" v-model="draft.company" class="input" />
        </div>
        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="draft.email" type="email" class="input" />
        </div>
        <div>
          <label class="label" for="phone">Phone</label>
          <input id="phone" v-model="draft.phone" class="input" />
        </div>
        <div>
          <label class="label" for="source">Source</label>
          <select id="source" v-model="draft.source" class="input">
            <option :value="null">—</option>
            <option value="referral">Referral</option>
            <option value="cold">Cold</option>
            <option value="repeat">Repeat</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="label" for="status">Status</label>
          <select id="status" v-model="draft.status" class="input">
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <h2 class="font-serif text-lg text-ink mb-2">Notes</h2>
        <TiptapEditor v-model="draft.notes" min-height="200px" />
      </div>
    </div>

    <section v-if="relatedProjects.length">
      <h2 class="font-serif text-lg text-ink mb-2">Projects</h2>
      <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
        <li
          v-for="(p, idx) in relatedProjects"
          :key="p.id"
          @click="router.push(`/projects/${p.id}`)"
          :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60']"
        >
          <span class="flex-1 truncate">{{ p.name }}</span>
          <StatusBadge :status="p.status" variant="project" />
        </li>
      </ul>
    </section>

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
