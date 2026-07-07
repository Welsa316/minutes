<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { notes } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';
import NoteBoard from '../components/NoteBoard.vue';
import TagPicker from '../components/TagPicker.vue';
import SaveStatus from '../components/SaveStatus.vue';
import NoteIconPicker from '../components/NoteIconPicker.vue';
import NoteCoverPicker from '../components/NoteCoverPicker.vue';
import { useRecent } from '../composables/useRecent.js';
import { useAutosave } from '../composables/useAutosave.js';
import { useToastStore } from '../stores/toast.js';
import { useNotesStore } from '../stores/notes.js';
import { COVERS } from '../utils/noteCovers.js';
import { exportNoteMarkdown, exportNoteHtml, printNote } from '../utils/exportNote.js';

const recent = useRecent();
const toast = useToastStore();
const store = useNotesStore();
const route = useRoute();
const router = useRouter();

const original = ref(null);
const draft = ref(null);
const loading = ref(true);
const focus = ref(false);
const exportOpen = ref(false);
const exportWrap = ref(null);
const titleInput = ref(null);

const isPinned = computed(() => store.list.find((n) => n.id === Number(route.params.id))?.pinned || false);

function currentNote() { return { ...original.value, ...draft.value }; }
async function doExport(kind) {
  exportOpen.value = false;
  try {
    if (kind === 'md') await exportNoteMarkdown(currentNote());
    else if (kind === 'html') await exportNoteHtml(currentNote());
    else if (kind === 'print') await printNote(currentNote());
  } catch { toast.error('Export failed'); }
}
function onDocClick(e) { if (exportWrap.value && !exportWrap.value.contains(e.target)) exportOpen.value = false; }
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));

const autosave = useAutosave({
  data: draft,
  key: () => `note:${route.params.id}`,
  async save(snapshot) {
    const body = { ...snapshot };
    delete body.universal_tags; delete body.created_at; delete body.updated_at; delete body.pinned;
    const updated = await notes.update(route.params.id, body);
    original.value = updated;
    // Keep the rail row in sync (title, edited-time, icon, cover).
    store.patch(route.params.id, {
      title: updated.title, body: updated.body, icon: updated.icon,
      cover: updated.cover, updated_at: updated.updated_at,
    });
  },
});

async function load() {
  loading.value = true;
  focus.value = false;
  const n = await notes.get(route.params.id);
  original.value = n;
  const stash = autosave.pickupDraft();
  if (stash?.payload && (Date.now() - stash.ts) < 24 * 60 * 60 * 1000) {
    const a = JSON.stringify({ ...stash.payload, universal_tags: undefined });
    const b = JSON.stringify({ ...n, universal_tags: undefined });
    if (a !== b && confirm(`Unsaved local edits from ${new Date(stash.ts).toLocaleString()}. Restore?`)) {
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
  // Brand-new note (created blank from the rail) → select the title to type over.
  if (n.title === 'Untitled') {
    nextTick(() => { titleInput.value?.focus(); titleInput.value?.select(); });
  }
}

async function destroy() {
  const title = original.value.title;
  const id = route.params.id;
  await notes.remove(id);
  store.removeLocal(id);
  toast.show(`Deleted "${title}"`, {
    kind: 'info', ttl: 6000,
    action: { label: 'Undo', run: async () => { await notes.restore(id); toast.success('Restored'); store.load(); } },
  });
  router.replace('/notes');
}

async function setLayout(layout) {
  if (!draft.value || (draft.value.layout || 'doc') === layout) return;
  draft.value.layout = layout;
  try {
    await notes.update(route.params.id, { layout });
    original.value = { ...original.value, layout };
    store.patch(route.params.id, { layout });
  } catch { toast.error('Failed to switch layout'); }
}

// Live-sync title/icon/cover into the rail as they change (before autosave lands).
watch(() => draft.value && `${draft.value.title}|${draft.value.icon}|${draft.value.cover}`, () => {
  if (draft.value) store.patch(route.params.id, { title: draft.value.title, icon: draft.value.icon, cover: draft.value.cover });
});

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div v-if="loading" class="p-8 text-sm text-slate-warm">Loading…</div>
  <div v-else-if="draft" class="flex flex-col h-full">
    <!-- header -->
    <header class="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2 shrink-0 border-b border-sand/50">
      <RouterLink to="/notes" class="lg:hidden text-sm text-slate-warm hover:text-ink mr-1">← Notes</RouterLink>
      <SaveStatus :status="autosave.status.value" :last-saved-at="autosave.lastSavedAt.value" />
      <div class="flex-1" />
      <button
        @click="focus = !focus"
        :class="['text-sm px-2 py-0.5 rounded transition-colors', focus ? 'bg-terracotta text-white' : 'text-slate-warm hover:text-ink']"
        title="Focus mode"
      >Focus</button>
      <div ref="exportWrap" class="relative">
        <button @click="exportOpen = !exportOpen" class="text-sm text-slate-warm hover:text-ink">Export ▾</button>
        <div v-if="exportOpen" class="absolute right-0 top-full mt-1 bg-surface border border-sand rounded-md shadow-lg z-20 py-1 min-w-[10rem]">
          <button @click="doExport('md')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">Markdown (.md)</button>
          <button @click="doExport('html')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">HTML (.html)</button>
          <button @click="doExport('print')" class="block w-full text-left px-3 py-1.5 text-sm hover:bg-sand/50">Print / PDF</button>
        </div>
      </div>
      <button
        @click="store.togglePin(route.params.id, isPinned)"
        :class="['text-base leading-none px-1', isPinned ? 'opacity-100' : 'opacity-40 hover:opacity-80']"
        :title="isPinned ? 'Unpin' : 'Pin to top'"
      >📌</button>
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </header>

    <!-- scrollable page -->
    <div class="flex-1 overflow-y-auto" data-note-scroll>
      <div v-if="draft.cover" class="h-24 sm:h-28 w-full" :style="{ backgroundImage: COVERS[draft.cover] }" />

      <div class="max-w-[42rem] mx-auto px-5 sm:px-8 pt-5 pb-24">
        <div class="flex items-center gap-2 mb-1 -ml-1">
          <NoteIconPicker v-model="draft.icon" />
          <div class="flex-1" />
          <NoteCoverPicker v-model="draft.cover" />
        </div>

        <input
          ref="titleInput"
          v-model="draft.title"
          placeholder="Untitled"
          class="w-full text-3xl sm:text-4xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0 mb-2 leading-tight"
        />

        <div class="flex items-center gap-3 flex-wrap mb-4">
          <TagPicker entity-type="note" :entity-id="route.params.id" :initial="original.universal_tags || []" />
          <div class="ml-auto flex items-center gap-1 text-sm">
            <button @click="setLayout('doc')" :class="['px-2.5 py-1 rounded', (draft.layout || 'doc') !== 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Doc</button>
            <button @click="setLayout('board')" :class="['px-2.5 py-1 rounded', draft.layout === 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Board</button>
          </div>
        </div>

        <TiptapEditor
          v-if="(draft.layout || 'doc') !== 'board'"
          v-model="draft.body"
          centered
          :focus="focus"
          min-height="50vh"
        />
        <NoteBoard v-else parent-type="note" :parent-id="route.params.id" />
      </div>
    </div>
  </div>
</template>
