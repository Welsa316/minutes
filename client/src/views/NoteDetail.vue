<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { notes } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';
import NoteBoard from '../components/NoteBoard.vue';
import TagPicker from '../components/TagPicker.vue';
import PinButton from '../components/PinButton.vue';
import SaveStatus from '../components/SaveStatus.vue';
import { useRecent } from '../composables/useRecent.js';
import { useAutosave } from '../composables/useAutosave.js';
import { useToastStore } from '../stores/toast.js';
import { exportNoteMarkdown, exportNoteHtml, printNote } from '../utils/exportNote.js';

const recent = useRecent();
const toast = useToastStore();
const route = useRoute();
const router = useRouter();

const original = ref(null);
const draft = ref(null);
const loading = ref(true);
const exportOpen = ref(false);
const exportWrap = ref(null);

// Export uses the latest saved/edited content (draft has the live body).
function currentNote() {
  return { ...original.value, ...draft.value };
}
async function doExport(kind) {
  exportOpen.value = false;
  try {
    if (kind === 'md') await exportNoteMarkdown(currentNote());
    else if (kind === 'html') await exportNoteHtml(currentNote());
    else if (kind === 'print') await printNote(currentNote());
  } catch {
    toast.error('Export failed');
  }
}
function onDocClick(e) {
  if (exportWrap.value && !exportWrap.value.contains(e.target)) exportOpen.value = false;
}
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));

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

async function setLayout(layout) {
  if (!draft.value || draft.value.layout === layout) return;
  draft.value.layout = layout;
  try {
    await notes.update(route.params.id, { layout });
    original.value = { ...original.value, layout };
  } catch {
    toast.error('Failed to switch layout');
  }
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

      <div ref="exportWrap" class="relative">
        <button @click="exportOpen = !exportOpen" class="text-sm text-slate-warm hover:text-ink">Export ▾</button>
        <div v-if="exportOpen" class="absolute right-0 top-full mt-1 bg-surface border border-sand rounded-md shadow-lg z-20 py-1 min-w-[10rem]">
          <button @click="doExport('md')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">Markdown (.md)</button>
          <button @click="doExport('html')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">HTML (.html)</button>
          <button @click="doExport('print')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">Print / PDF</button>
        </div>
      </div>

      <PinButton entity-type="note" :entity-id="route.params.id" />
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <input
      v-model="draft.title"
      placeholder="Title"
      class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
    />

    <div class="flex items-center gap-3 flex-wrap">
      <TagPicker entity-type="note" :entity-id="route.params.id" :initial="original.universal_tags || []" />
      <div class="ml-auto flex items-center gap-1 text-sm">
        <button @click="setLayout('doc')" :class="['px-2.5 py-1 rounded', draft.layout !== 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Doc</button>
        <button @click="setLayout('board')" :class="['px-2.5 py-1 rounded', draft.layout === 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Board</button>
      </div>
    </div>

    <TiptapEditor v-if="draft.layout !== 'board'" v-model="draft.body" min-height="420px" max-height="68vh" />
    <NoteBoard v-else parent-type="note" :parent-id="route.params.id" />

    <p class="text-xs text-slate-warm">Created {{ fmtDate(original.created_at) }}</p>
  </div>
</template>
