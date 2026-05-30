<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { notes } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';
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
const loading = ref(true);

const autosave = useAutosave({
  data: draft,
  key: () => `note:${route.params.id}`,
  async save(snapshot) {
    const body = { ...snapshot };
    delete body.universal_tags; delete body.created_at;
    const updated = await notes.update(route.params.id, body);
    original.value = updated;
  },
});

async function load() {
  loading.value = true;
  const n = await notes.get(route.params.id);
  original.value = n;
  const stash = autosave.pickupDraft();
  if (stash?.payload && (Date.now() - stash.ts) < 24 * 60 * 60 * 1000) {
    const stashStr = JSON.stringify({ ...stash.payload, universal_tags: undefined });
    const serverStr = JSON.stringify({ ...n, universal_tags: undefined });
    if (stashStr !== serverStr && confirm(`Unsaved local edits from ${new Date(stash.ts).toLocaleString()}. Restore?`)) {
      draft.value = { ...n, ...stash.payload };
    } else {
      draft.value = { ...n };
      autosave.clearDraft();
    }
  } else {
    draft.value = { ...n };
  }
  loading.value = false;
  autosave.seed();
  recent.visit({ kind: 'note', id: n.id, title: n.title });
}

async function destroy() {
  const title = original.value.title;
  await notes.remove(route.params.id);
  toast.show(`Deleted "${title}"`, {
    kind: 'info', ttl: 6000,
    action: { label: 'Undo', run: async () => { await notes.restore(route.params.id); toast.success('Restored'); load(); } },
  });
  router.replace('/notes');
}

function fmtDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
  <div v-else-if="draft" class="max-w-4xl space-y-5">
    <header class="flex items-center gap-4">
      <RouterLink to="/notes" class="text-sm text-slate-warm hover:text-ink">&larr; Notes</RouterLink>
      <div class="flex-1" />
      <SaveStatus :status="autosave.status.value" :last-saved-at="autosave.lastSavedAt.value" />
      <PinButton entity-type="note" :entity-id="route.params.id" />
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <input
      v-model="draft.title"
      placeholder="Title"
      class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
    />

    <TagPicker entity-type="note" :entity-id="route.params.id" :initial="original.universal_tags || []" />

    <TiptapEditor v-model="draft.body" min-height="420px" max-height="68vh" />

    <p class="text-xs text-slate-warm">Created {{ fmtDate(original.created_at) }}</p>
  </div>
</template>
