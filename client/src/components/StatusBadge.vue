<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
  variant: { type: String, default: 'client' },
  editable: { type: Boolean, default: false },
});
const emit = defineEmits(['change']);

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
  feedback: {
    new: 'bg-terracotta/15 text-terracotta',
    triaged: 'bg-sand text-ink',
    planned: 'bg-slate-warm/20 text-slate-warm',
    shipped: 'bg-slate-warm/10 text-slate-warm',
    declined: 'bg-slate-warm/10 text-slate-warm',
  },
  invoice: {
    draft: 'bg-sand text-ink',
    sent: 'bg-terracotta/15 text-terracotta',
    paid: 'bg-[#3F6B4C]/15 text-[#3F6B4C]',
    overdue: 'bg-red-500/15 text-red-600',
  },
};

const OPTIONS = {
  client: ['lead', 'active', 'paused', 'archived'],
  project: ['proposed', 'active', 'on_hold', 'done'],
  feedback: ['new', 'triaged', 'planned', 'shipped', 'declined'],
  invoice: ['draft', 'sent', 'paid'],
};

const classes = computed(() => COLORS[props.variant]?.[props.status] || 'bg-sand text-ink');
const label = (s) => s.replace(/_/g, ' ');
const open = ref(false);
const wrap = ref(null);

function pick(s) {
  open.value = false;
  if (s !== props.status) emit('change', s);
}

function onDocClick(e) {
  if (wrap.value && !wrap.value.contains(e.target)) open.value = false;
}
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
</script>

<template>
  <span ref="wrap" class="relative inline-block" @click.stop>
    <span
      :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', classes, editable && 'cursor-pointer hover:ring-1 hover:ring-sand']"
      @click="editable && (open = !open)"
    >{{ label(status) }}</span>
    <div
      v-if="editable && open"
      class="absolute right-0 top-full mt-1 bg-surface border border-sand rounded-md shadow-lg z-20 py-1 min-w-[8rem]"
    >
      <button
        v-for="opt in OPTIONS[variant]"
        :key="opt"
        type="button"
        @click="pick(opt)"
        :class="['block w-full text-left px-3 py-1.5 text-xs hover:bg-sand/50', opt === status && 'bg-sand/40 font-medium']"
      >{{ label(opt) }}</button>
    </div>
  </span>
</template>
