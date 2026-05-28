<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { clientColor, initials } from '../utils/colors.js';

const props = defineProps({
  client: { type: Object, default: null }, // { id, name }
  name: { type: String, default: '' },     // fallback when only name known
  id: { type: [Number, String], default: null },
  size: { type: String, default: 'sm' },   // sm | md | lg
  hideLabel: { type: Boolean, default: false },
  to: { type: String, default: null },     // override link path
});

const displayName = computed(() => props.client?.name || props.name);
const linkId = computed(() => props.client?.id ?? props.id);
const palette = computed(() => clientColor(displayName.value));
const init = computed(() => initials(displayName.value));

const sizeClasses = computed(() => {
  if (props.size === 'lg') return { dot: 'h-9 w-9 text-base', wrap: 'gap-2.5 text-sm' };
  if (props.size === 'md') return { dot: 'h-7 w-7 text-xs', wrap: 'gap-2 text-sm' };
  return { dot: 'h-5 w-5 text-[10px]', wrap: 'gap-1.5 text-sm' };
});

const tag = computed(() => (linkId.value || props.to ? 'RouterLink' : 'span'));
const target = computed(() => props.to || (linkId.value ? `/clients/${linkId.value}` : null));
</script>

<template>
  <component
    :is="tag"
    v-if="displayName"
    :to="target"
    :class="['inline-flex items-center font-medium', sizeClasses.wrap, target && 'hover:opacity-80']"
  >
    <span
      :class="['inline-flex items-center justify-center rounded-full font-semibold tabular-nums shrink-0', sizeClasses.dot]"
      :style="{ background: palette.soft, color: palette.text }"
    >{{ init }}</span>
    <span v-if="!hideLabel" class="text-ink truncate">{{ displayName }}</span>
  </component>
</template>
