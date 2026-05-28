<script setup>
import { ref } from 'vue';
import { actionItems as api } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';
import { useSettingsStore } from '../stores/settings.js';
import { celebrate } from '../utils/confetti.js';
import { sounds } from '../utils/sounds.js';

const settings = useSettingsStore();

const props = defineProps({
  meetingId: { type: [Number, String], required: true },
  items: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:items']);

const toast = useToastStore();
const newLabel = ref('');
const pending = ref(new Set());

function mark(id, on) {
  const next = new Set(pending.value);
  on ? next.add(id) : next.delete(id);
  pending.value = next;
}

async function add() {
  const label = newLabel.value.trim();
  if (!label) return;
  // Optimistic: append a temp item immediately, swap in the real one on success.
  const tempId = `tmp-${Date.now()}`;
  const tempItem = { id: tempId, meeting_id: Number(props.meetingId), label, due_date: null, done: false, _pending: true };
  emit('update:items', [...props.items, tempItem]);
  newLabel.value = '';
  try {
    const real = await api.create({ meeting_id: Number(props.meetingId), label });
    emit('update:items', props.items.map((i) => (i.id === tempId ? real : i)));
  } catch (e) {
    emit('update:items', props.items.filter((i) => i.id !== tempId));
    toast.error('Failed to add action item');
  }
}

async function toggle(item, ev) {
  // Flip locally first.
  const optimistic = { ...item, done: !item.done };
  const next = props.items.map((i) => (i.id === item.id ? optimistic : i));
  emit('update:items', next);
  mark(item.id, true);

  if (settings.sound) sounds.pop();

  // Were we one open item away from done? Celebrate if so.
  if (!item.done) {
    const stillOpen = next.filter((i) => !i.done).length;
    if (stillOpen === 0 && props.items.length >= 1) {
      const rect = ev?.target?.getBoundingClientRect?.();
      const origin = rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.6 };
      celebrate(origin);
    }
  }

  try {
    const real = await api.toggle(item.id);
    emit('update:items', props.items.map((i) => (i.id === item.id ? real : i)));
  } catch (e) {
    emit('update:items', props.items.map((i) => (i.id === item.id ? item : i)));
    toast.error('Failed to update — reverted');
  } finally {
    mark(item.id, false);
  }
}

async function destroy(item) {
  const snapshot = props.items;
  emit('update:items', props.items.filter((i) => i.id !== item.id));
  try {
    await api.remove(item.id);
  } catch (e) {
    emit('update:items', snapshot);
    toast.error('Failed to delete — restored');
  }
}

async function updateDue(item, value) {
  const optimistic = { ...item, due_date: value || null };
  emit('update:items', props.items.map((i) => (i.id === item.id ? optimistic : i)));
  try {
    const real = await api.update(item.id, { due_date: value || null });
    emit('update:items', props.items.map((i) => (i.id === item.id ? real : i)));
  } catch (e) {
    emit('update:items', props.items.map((i) => (i.id === item.id ? item : i)));
    toast.error('Failed to update date');
  }
}

async function updateLabel(item, value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === item.label) return;
  const optimistic = { ...item, label: trimmed };
  emit('update:items', props.items.map((i) => (i.id === item.id ? optimistic : i)));
  try {
    const real = await api.update(item.id, { label: trimmed });
    emit('update:items', props.items.map((i) => (i.id === item.id ? real : i)));
  } catch (e) {
    emit('update:items', props.items.map((i) => (i.id === item.id ? item : i)));
    toast.error('Failed to update label');
  }
}

function ymd(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}
</script>

<template>
  <div>
    <TransitionGroup name="ai" tag="ul" v-if="items.length" class="divide-y divide-sand/60">
      <li
        v-for="i in items"
        :key="i.id"
        :class="['flex items-center gap-3 py-1.5 group transition-opacity', i._pending && 'opacity-60']"
      >
        <input
          type="checkbox"
          :checked="i.done"
          @change="toggle(i, $event)"
          class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40"
        />
        <input
          :value="i.label"
          @change="updateLabel(i, $event.target.value)"
          :class="['flex-1 bg-transparent focus:outline-none text-sm transition-colors', i.done && 'line-through text-slate-warm']"
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
    </TransitionGroup>
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

<style scoped>
.ai-enter-active, .ai-leave-active {
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ai-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.ai-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
.ai-move {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
