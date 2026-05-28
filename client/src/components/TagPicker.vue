<script setup>
import { ref, computed, onMounted } from 'vue';
import { tags as api } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';
import TagChip from './TagChip.vue';

const props = defineProps({
  entityType: { type: String, required: true }, // client | project | meeting | note
  entityId: { type: [Number, String], required: true },
  initial: { type: Array, default: () => [] }, // array of tag name strings
});
const emit = defineEmits(['update:tags']);

const toast = useToastStore();
const current = ref([...props.initial]);
const input = ref('');
const suggesting = ref(false);
const allTags = ref([]);
const inputEl = ref(null);

const suggestions = computed(() => {
  const q = input.value.trim().replace(/^#/, '').toLowerCase();
  return allTags.value
    .filter((t) => !current.value.includes(t.name))
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .slice(0, 6);
});

async function loadAll() {
  try { allTags.value = await api.list(); } catch {}
}

async function addTag(name) {
  const clean = name.trim().replace(/^#/, '');
  if (!clean || current.value.includes(clean)) return;
  current.value = [...current.value, clean];
  emit('update:tags', current.value);
  input.value = '';
  try {
    await api.attach(props.entityType, props.entityId, clean);
    await loadAll();
  } catch (e) {
    current.value = current.value.filter((t) => t !== clean);
    emit('update:tags', current.value);
    toast.error('Failed to add tag');
  }
}

async function remove(name) {
  const snapshot = [...current.value];
  current.value = current.value.filter((t) => t !== name);
  emit('update:tags', current.value);
  try {
    const tag = allTags.value.find((t) => t.name === name);
    if (tag) await api.detach(props.entityType, props.entityId, tag.id);
  } catch (e) {
    current.value = snapshot;
    emit('update:tags', current.value);
    toast.error('Failed to remove tag');
  }
}

function onEnter() {
  if (suggestions.value.length) addTag(suggestions.value[0].name);
  else if (input.value.trim()) addTag(input.value);
}

onMounted(loadAll);
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <TagChip
      v-for="t in current"
      :key="t"
      :tag="t"
      removable
      @remove="remove"
    />
    <div class="relative">
      <input
        ref="inputEl"
        v-model="input"
        @focus="suggesting = true"
        @blur="setTimeout(() => suggesting = false, 150)"
        @keydown.enter.prevent="onEnter"
        @keydown.escape="input = ''"
        placeholder="+ tag"
        class="text-xs px-1.5 py-0.5 border-b border-transparent hover:border-sand focus:border-ink bg-transparent focus:outline-none placeholder-slate-warm w-20 transition-colors"
      />
      <div
        v-if="suggesting && (suggestions.length || input.trim())"
        class="absolute left-0 top-full mt-1 bg-warm border border-sand rounded-md shadow-md z-20 min-w-[8rem] py-1"
      >
        <button
          v-for="s in suggestions"
          :key="s.id"
          type="button"
          @mousedown.prevent="addTag(s.name)"
          class="block w-full text-left px-2 py-1 text-xs hover:bg-sand/50"
        >#{{ s.name }}<span class="text-slate-warm ml-1">({{ s.usage_count }})</span></button>
        <button
          v-if="input.trim() && !suggestions.some(s => s.name === input.trim().replace(/^#/, ''))"
          type="button"
          @mousedown.prevent="addTag(input)"
          class="block w-full text-left px-2 py-1 text-xs hover:bg-sand/50 text-terracotta"
        >+ Create #{{ input.trim().replace(/^#/, '') }}</button>
      </div>
    </div>
  </div>
</template>
