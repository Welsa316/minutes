<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { notes } from '../api/endpoints.js';
import TiptapEditor from '../components/TiptapEditor.vue';

const route = useRoute();
const router = useRouter();

const original = ref(null);
const draft = ref(null);
const tagsInput = ref('');
const loading = ref(true);
const saving = ref(false);

const tagsArray = computed(() =>
  tagsInput.value
    .split(',')
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean)
);

const dirty = computed(() => {
  if (!original.value || !draft.value) return false;
  const cur = { ...draft.value, tags: tagsArray.value };
  return JSON.stringify(original.value) !== JSON.stringify(cur);
});

async function load() {
  loading.value = true;
  const n = await notes.get(route.params.id);
  original.value = n;
  draft.value = { ...n };
  tagsInput.value = (n.tags || []).join(', ');
  loading.value = false;
}

async function save() {
  saving.value = true;
  try {
    const updated = await notes.update(route.params.id, { ...draft.value, tags: tagsArray.value });
    original.value = updated;
    draft.value = { ...updated };
    tagsInput.value = (updated.tags || []).join(', ');
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  if (!confirm(`Delete "${original.value.title}"? This cannot be undone.`)) return;
  await notes.remove(route.params.id);
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
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
      <button @click="save" :disabled="!dirty || saving" class="btn-primary text-sm">
        {{ saving ? 'Saving…' : dirty ? 'Save' : 'Saved' }}
      </button>
    </header>

    <input
      v-model="draft.title"
      placeholder="Title"
      class="w-full text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0"
    />

    <div class="flex items-center gap-3 text-sm">
      <label class="text-slate-warm" for="tags">Tags</label>
      <input
        id="tags"
        v-model="tagsInput"
        placeholder="comma, separated, tags"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
    </div>

    <TiptapEditor v-model="draft.body" min-height="420px" />

    <p class="text-xs text-slate-warm">Created {{ fmtDate(original.created_at) }}</p>
  </div>
</template>
