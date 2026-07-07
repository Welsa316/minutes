<script setup>
import { computed } from 'vue';
import { WS_ICONS } from '../utils/workspaceIcons.js';

const props = defineProps({ icon: { type: String, default: '' } });
// A known key → Lucide icon component; anything else (legacy letter / emoji) → text.
const IconComp = computed(() => WS_ICONS[props.icon] || null);
</script>

<template>
  <component :is="IconComp" v-if="IconComp" class="w-[1.1em] h-[1.1em]" :stroke-width="2" />
  <span v-else>{{ icon || '?' }}</span>
</template>
