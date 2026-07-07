<script setup>
import { computed } from 'vue';
import { WS_ICONS } from '../utils/workspaceIcons.js';

const props = defineProps({ icon: { type: String, default: '' } });
// A known key → line icon; anything else (legacy letter / emoji) → render as text.
const paths = computed(() => WS_ICONS[props.icon] || null);
</script>

<template>
  <svg
    v-if="paths"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
    class="w-[1.1em] h-[1.1em]"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
  <span v-else>{{ icon || '?' }}</span>
</template>
