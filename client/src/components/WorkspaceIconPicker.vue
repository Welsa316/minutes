<script setup>
import { WS_ICON_KEYS } from '../utils/workspaceIcons.js';
import WorkspaceIcon from './WorkspaceIcon.vue';

defineProps({
  modelValue: { type: String, default: '' },
  accent: { type: String, default: '#C65D3E' },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="grid grid-cols-8 gap-1">
    <button
      v-for="k in WS_ICON_KEYS"
      :key="k"
      type="button"
      @click="$emit('update:modelValue', k)"
      :class="['h-8 grid place-items-center rounded-md border text-lg transition-colors',
               modelValue === k ? 'border-terracotta bg-terracotta/10' : 'border-transparent text-slate-warm hover:bg-sand/60']"
      :style="modelValue === k ? { color: accent } : null"
    >
      <WorkspaceIcon :icon="k" />
    </button>
  </div>
</template>
