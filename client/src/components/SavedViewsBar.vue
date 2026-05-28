<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { savedViews as api } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  section: { type: String, required: true }, // clients | projects | meetings | notes
  // The set of query params that count as "filters" we want to save.
  filterKeys: { type: Array, default: () => ['tag', 'status', 'filter'] },
});

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const views = ref([]);
const savingName = ref('');
const showSave = ref(false);

const activeFilters = computed(() => {
  const out = {};
  for (const k of props.filterKeys) {
    if (route.query[k] != null && route.query[k] !== '') out[k] = route.query[k];
  }
  return out;
});

const hasFilters = computed(() => Object.keys(activeFilters.value).length > 0);

const matchingViewId = computed(() => {
  const cur = JSON.stringify(activeFilters.value);
  return views.value.find((v) => JSON.stringify(v.filters || {}) === cur)?.id || null;
});

async function load() {
  try { views.value = await api.list(props.section); }
  catch { views.value = []; }
}

function apply(view) {
  router.replace({ query: { ...view.filters } });
}

function clearFilters() {
  router.replace({ query: {} });
}

async function save() {
  if (!savingName.value.trim()) return;
  try {
    const v = await api.create({
      name: savingName.value.trim(),
      section: props.section,
      filters: activeFilters.value,
    });
    views.value = [...views.value, v];
    savingName.value = '';
    showSave.value = false;
    toast.success('View saved');
  } catch {
    toast.error('Failed to save view');
  }
}

async function remove(view) {
  if (!confirm(`Delete view "${view.name}"?`)) return;
  try {
    await api.remove(view.id);
    views.value = views.value.filter((v) => v.id !== view.id);
  } catch { toast.error('Failed to delete view'); }
}

onMounted(load);
</script>

<template>
  <div v-if="views.length || hasFilters" class="flex items-center gap-2 flex-wrap text-sm">
    <button
      v-for="v in views"
      :key="v.id"
      @click="apply(v)"
      :class="['group inline-flex items-center gap-1 px-2.5 py-1 rounded transition-colors', matchingViewId === v.id ? 'bg-terracotta/15 text-terracotta' : 'text-slate-warm hover:bg-sand/60 hover:text-ink']"
    >
      {{ v.name }}
      <button
        type="button"
        @click.stop="remove(v)"
        class="opacity-0 group-hover:opacity-60 hover:!opacity-100 -mr-1 text-xs"
        title="Delete view"
      >×</button>
    </button>

    <span v-if="views.length && hasFilters" class="text-slate-warm/40">·</span>

    <template v-if="hasFilters && !matchingViewId">
      <button
        v-if="!showSave"
        @click="showSave = true"
        class="px-2.5 py-1 rounded text-slate-warm hover:bg-sand/60 hover:text-ink"
      >Save view…</button>
      <form
        v-else
        @submit.prevent="save"
        class="inline-flex items-center gap-1 bg-warm border border-sand rounded px-2 py-0.5"
      >
        <input
          v-model="savingName"
          @keydown.escape="showSave = false; savingName = ''"
          autofocus
          placeholder="View name"
          class="bg-transparent focus:outline-none text-xs w-24"
        />
        <button type="submit" :disabled="!savingName.trim()" class="text-xs text-terracotta disabled:opacity-50">Save</button>
      </form>
      <button @click="clearFilters" class="text-xs text-slate-warm hover:text-ink">clear</button>
    </template>
  </div>
</template>
