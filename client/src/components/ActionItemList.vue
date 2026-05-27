<script setup>
import { ref } from 'vue';
import { actionItems as api } from '../api/endpoints.js';

const props = defineProps({
  meetingId: { type: [Number, String], required: true },
  items: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:items']);

const newLabel = ref('');
const adding = ref(false);

async function add() {
  const label = newLabel.value.trim();
  if (!label) return;
  adding.value = true;
  try {
    const item = await api.create({ meeting_id: Number(props.meetingId), label });
    emit('update:items', [...props.items, item]);
    newLabel.value = '';
  } finally {
    adding.value = false;
  }
}

async function toggle(item) {
  const updated = await api.toggle(item.id);
  emit('update:items', props.items.map((i) => (i.id === item.id ? updated : i)));
}

async function destroy(item) {
  await api.remove(item.id);
  emit('update:items', props.items.filter((i) => i.id !== item.id));
}

async function updateDue(item, value) {
  const updated = await api.update(item.id, { due_date: value || null });
  emit('update:items', props.items.map((i) => (i.id === item.id ? updated : i)));
}

async function updateLabel(item, value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === item.label) return;
  const updated = await api.update(item.id, { label: trimmed });
  emit('update:items', props.items.map((i) => (i.id === item.id ? updated : i)));
}

function ymd(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}
</script>

<template>
  <div>
    <ul v-if="items.length" class="divide-y divide-sand/60">
      <li v-for="i in items" :key="i.id" class="flex items-center gap-3 py-1.5 group">
        <input
          type="checkbox"
          :checked="i.done"
          @change="toggle(i)"
          class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40"
        />
        <input
          :value="i.label"
          @change="updateLabel(i, $event.target.value)"
          :class="['flex-1 bg-transparent focus:outline-none text-sm', i.done && 'line-through text-slate-warm']"
        />
        <input
          type="date"
          :value="ymd(i.due_date)"
          @change="updateDue(i, $event.target.value)"
          class="text-xs px-1.5 py-0.5 border border-transparent hover:border-sand focus:border-sand rounded text-slate-warm bg-transparent focus:outline-none"
        />
        <button
          type="button"
          @click="destroy(i)"
          class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity w-5 text-center"
          title="Delete"
        >&times;</button>
      </li>
    </ul>
    <form @submit.prevent="add" class="mt-1 flex items-center gap-2">
      <span class="w-4" />
      <input
        v-model="newLabel"
        placeholder="Add action item…"
        class="flex-1 px-0 py-1.5 border-b border-transparent hover:border-sand focus:border-ink bg-transparent focus:outline-none text-sm placeholder-slate-warm/60 transition-colors"
      />
    </form>
  </div>
</template>
