<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
  variant: { type: String, default: 'client' },
});

const COLORS = {
  client: {
    lead: 'bg-sand text-ink',
    active: 'bg-terracotta/15 text-terracotta',
    paused: 'bg-slate-warm/20 text-slate-warm',
    archived: 'bg-slate-warm/10 text-slate-warm',
  },
  project: {
    proposed: 'bg-sand text-ink',
    active: 'bg-terracotta/15 text-terracotta',
    on_hold: 'bg-slate-warm/20 text-slate-warm',
    done: 'bg-slate-warm/10 text-slate-warm',
  },
};

const classes = computed(() => COLORS[props.variant]?.[props.status] || 'bg-sand text-ink');
const label = computed(() => props.status?.replace(/_/g, ' '));
</script>

<template>
  <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', classes]">{{ label }}</span>
</template>
