<script setup>
import { ref, watch, onMounted } from 'vue';
import { pinned as api } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  entityType: { type: String, required: true },
  entityId: { type: [Number, String], required: true },
});

const toast = useToastStore();
const isPinned = ref(false);

async function refresh() {
  try {
    const all = await api.list();
    isPinned.value = all.some((p) => p.entity_type === props.entityType && p.entity_id === Number(props.entityId));
  } catch { isPinned.value = false; }
}

async function toggle() {
  isPinned.value = !isPinned.value;
  try {
    if (isPinned.value) await api.add(props.entityType, Number(props.entityId));
    else await api.remove(props.entityType, Number(props.entityId));
  } catch (e) {
    isPinned.value = !isPinned.value;
    toast.error('Failed to update pin');
  }
}

watch(() => [props.entityType, props.entityId], refresh);
onMounted(refresh);
</script>

<template>
  <button
    type="button"
    @click="toggle"
    :class="['text-sm transition-colors', isPinned ? 'text-terracotta' : 'text-slate-warm hover:text-ink']"
    :title="isPinned ? 'Unpin' : 'Pin to sidebar'"
  >
    <svg v-if="isPinned" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" stroke="none">
      <path d="M14 4l6 6-4 1-3 3-1 6-2-2-5 5-1-1 5-5-2-2 6-1 3-3z"/>
    </svg>
    <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 4l6 6-4 1-3 3-1 6-2-2-5 5-1-1 5-5-2-2 6-1 3-3z"/>
    </svg>
  </button>
</template>
