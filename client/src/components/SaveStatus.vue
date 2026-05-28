<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  status: { type: String, required: true },     // idle | dirty | saving | saved | error
  lastSavedAt: { type: Number, default: null }, // epoch ms
});

const now = ref(Date.now());
let interval;
onMounted(() => { interval = setInterval(() => { now.value = Date.now(); }, 30_000); });
onBeforeUnmount(() => clearInterval(interval));

const relative = computed(() => {
  if (!props.lastSavedAt) return '';
  const diff = Math.round((now.value - props.lastSavedAt) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(props.lastSavedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
});

const label = computed(() => {
  if (props.status === 'saving') return 'Saving…';
  if (props.status === 'dirty')  return 'Editing…';
  if (props.status === 'error')  return 'Save failed — retrying';
  if (props.status === 'saved')  return relative.value ? `Saved · ${relative.value}` : 'Saved';
  return '';
});
const tone = computed(() => {
  if (props.status === 'error') return 'text-terracotta';
  if (props.status === 'saving' || props.status === 'dirty') return 'text-slate-warm';
  return 'text-slate-warm/70';
});
</script>

<template>
  <span :class="['text-xs tabular-nums', tone]">{{ label }}</span>
</template>
