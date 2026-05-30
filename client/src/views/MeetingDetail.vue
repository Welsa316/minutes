<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { meetings, clients, projects } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';
import ActionItemList from '../components/ActionItemList.vue';
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

const draft = ref(null);
const original = ref(null);
const dateLocal = ref('');
const actionItems = ref([]);
const allClients = ref([]);
const allProjects = ref([]);
const loading = ref(true);

const TABS = ['pre', 'during', 'after'];
const tab = computed({
  get: () => TABS.includes(route.query.tab) ? route.query.tab : 'pre',
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'pre' ? undefined : v } }),
});

const filteredProjects = computed(() => {
  if (!draft.value?.client_id) return allProjects.value;
  return allProjects.value.filter((p) => p.client_id === Number(draft.value.client_id) || p.id === draft.value.project_id);
});

const openActionItems = computed(() => actionItems.value.filter((i) => !i.done).length);

const autosave = useAutosave({
  data: draft,
  key: () => `meeting:${route.params.id}`,
  async save(snapshot) {
    const body = { ...snapshot };
    body.date = dateLocal.value ? new Date(dateLocal.value).toISOString() : null;
    delete body.client_name;
    delete body.project_name;
    delete body.action_items;
    delete body.tags;
    delete body.created_at;
    const updated = await meetings.update(route.params.id, body);
    original.value = updated;
    // Important: don't slam draft.value here — that would clobber whatever the
    // user has typed since the request started. We trust the autosave flow.
  },
});

async function load() {
  loading.value = true;
  const id = route.params.id;
  const [m, c, p] = await Promise.all([
    meetings.get(id),
    clients.list(),
    projects.list(),
  ]);
  const { action_items, ...rest } = m;
  original.value = rest;

  // If there's a localStorage draft newer than the server's updated_at, offer to restore.
  const stash = autosave.pickupDraft();
  if (stash?.payload && (Date.now() - stash.ts) < 24 * 60 * 60 * 1000) {
    // Only restore if the stash is meaningfully different from the server copy.
    const stashStr = JSON.stringify({ ...stash.payload, action_items: undefined, tags: undefined, client_name: undefined, project_name: undefined });
    const serverStr = JSON.stringify({ ...rest, action_items: undefined, tags: undefined, client_name: undefined, project_name: undefined });
    if (stashStr !== serverStr) {
      const ok = confirm(`You have unsaved local edits from ${new Date(stash.ts).toLocaleString()}.\n\nRestore them? (Cancel = discard local copy and use the saved version)`);
      if (ok) {
        draft.value = { ...rest, ...stash.payload };
      } else {
        draft.value = { ...rest };
        autosave.clearDraft();
      }
    } else {
      draft.value = { ...rest };
      autosave.clearDraft();
    }
  } else {
    draft.value = { ...rest };
  }

  dateLocal.value = m.date ? toLocalInput(m.date) : '';
  actionItems.value = action_items || [];
  allClients.value = c;
  allProjects.value = p;
  loading.value = false;
  autosave.seed();
  recent.visit({ kind: 'meeting', id: m.id, title: m.title });
}

// Treat the date input as "dirty" too — kick the autosave when it changes.
watch(dateLocal, () => {
  if (!draft.value) return;
  // Touch a sentinel field to force the deep watcher to fire.
  draft.value._dateBump = (draft.value._dateBump || 0) + 1;
});

async function destroy() {
  const meetingTitle = original.value.title;
  await meetings.remove(route.params.id);
  toast.show(`Deleted "${meetingTitle}"`, {
    kind: 'info',
    ttl: 6000,
    action: {
      label: 'Undo',
      run: async () => {
        await meetings.restore(route.params.id);
        toast.success('Restored');
        // Reload data in case user is still here. If we left already, no-op.
        if (route.params.id) load();
      },
    },
  });
  router.replace('/meetings');
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
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
  <div v-else-if="draft" class="max-w-4xl space-y-5">
    <header class="flex items-center gap-4">
      <RouterLink to="/meetings" class="text-sm text-slate-warm hover:text-ink">&larr; Meetings</RouterLink>
      <div class="flex-1" />
      <SaveStatus :status="autosave.status.value" :last-saved-at="autosave.lastSavedAt.value" />
      <PinButton entity-type="meeting" :entity-id="route.params.id" />
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <input
      v-model="draft.title"
      placeholder="Title"
      class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
    />

    <input
      v-model="draft.subject"
      placeholder="Subject — what's it about?"
      class="w-full text-base text-slate-warm bg-transparent border-none focus:outline-none focus:ring-0 px-0 -mt-1"
    />

    <TagPicker entity-type="meeting" :entity-id="route.params.id" :initial="original.tags || []" />

    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 card">
      <div>
        <label class="label" for="m-date">When</label>
        <input id="m-date" v-model="dateLocal" type="datetime-local" class="input" />
      </div>
      <div>
        <label class="label" for="m-loc">Where</label>
        <select id="m-loc" v-model="draft.location" class="input">
          <option :value="null">—</option>
          <option value="video">Video</option>
          <option value="phone">Phone</option>
          <option value="in-person">In person</option>
        </select>
      </div>
      <div>
        <label class="label" for="m-client">Client</label>
        <select id="m-client" v-model="draft.client_id" class="input">
          <option :value="null">—</option>
          <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="m-project">Project</label>
        <select id="m-project" v-model="draft.project_id" class="input">
          <option :value="null">—</option>
          <option v-for="p in filteredProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <div class="border-b border-sand flex items-center gap-1 overflow-x-auto">
      <button
        @click="tab = 'pre'"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                 tab === 'pre' ? 'border-terracotta text-ink' : 'border-transparent text-slate-warm hover:text-ink']"
      >Pre-meeting</button>
      <button
        @click="tab = 'during'"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                 tab === 'during' ? 'border-terracotta text-ink' : 'border-transparent text-slate-warm hover:text-ink']"
      >During</button>
      <button
        @click="tab = 'after'"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                 tab === 'after' ? 'border-terracotta text-ink' : 'border-transparent text-slate-warm hover:text-ink']"
      >
        After
        <span v-if="openActionItems" class="inline-flex items-center justify-center text-xs px-1.5 rounded-full bg-terracotta/15 text-terracotta">{{ openActionItems }}</span>
      </button>
    </div>

    <section v-show="tab === 'pre'">
      <p class="text-sm text-slate-warm mb-2">Prep notes, questions, agenda.</p>
      <TiptapEditor v-model="draft.pre_notes" min-height="320px" max-height="62vh" />
    </section>

    <section v-show="tab === 'during'">
      <p class="text-sm text-slate-warm mb-2">Live notes during the meeting.</p>
      <TiptapEditor v-model="draft.live_notes" min-height="380px" max-height="64vh" />
    </section>

    <section v-show="tab === 'after'" class="space-y-6">
      <div>
        <p class="text-sm text-slate-warm mb-2">Summary.</p>
        <TiptapEditor v-model="draft.summary" min-height="240px" max-height="48vh" />
      </div>
      <div>
        <h3 class="font-serif text-lg text-ink mb-2">Action items</h3>
        <ActionItemList
          :meeting-id="route.params.id"
          :items="actionItems"
          @update:items="actionItems = $event"
        />
      </div>
    </section>

    <p class="text-xs text-slate-warm">Created {{ fmtDate(original.created_at) }}</p>
  </div>
</template>
