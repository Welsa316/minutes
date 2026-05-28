<script setup>
import { ref, computed } from 'vue';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { RouterLink } from 'vue-router';
import { clients, projects, meetings, notes } from '../api/endpoints.js';
import { clientColor, initials } from '../utils/colors.js';
import StatusBadge from './StatusBadge.vue';
import { humanizeDate, humanizeDay } from '../utils/dates.js';

const props = defineProps({
  kind: { type: String, required: true }, // client | project | meeting | note
  id: { type: [Number, String], required: true },
  delay: { type: Number, default: 350 },
});

const trigger = ref(null);
const floatingEl = ref(null);
const open = ref(false);
const data = ref(null);
let timer = null;
let hideTimer = null;

const { floatingStyles } = useFloating(trigger, floatingEl, {
  placement: 'top-start',
  middleware: [offset(8), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
});

async function fetchData() {
  try {
    if (props.kind === 'client') data.value = await clients.get(props.id);
    else if (props.kind === 'project') data.value = await projects.get(props.id);
    else if (props.kind === 'meeting') data.value = await meetings.get(props.id);
    else if (props.kind === 'note') data.value = await notes.get(props.id);
  } catch { data.value = null; }
}

function onEnter() {
  clearTimeout(hideTimer);
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!data.value) await fetchData();
    open.value = true;
  }, props.delay);
}

function onLeave() {
  clearTimeout(timer);
  hideTimer = setTimeout(() => { open.value = false; }, 120);
}

const palette = computed(() => clientColor(data.value?.name || data.value?.title || ''));

const target = computed(() => {
  if (props.kind === 'note') return `/notes/${props.id}`;
  return `/${props.kind}s/${props.id}`;
});
</script>

<template>
  <span
    ref="trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="hov">
        <div
          v-if="open && data"
          ref="floatingEl"
          :style="floatingStyles"
          @mouseenter="onEnter"
          @mouseleave="onLeave"
          class="z-[60] bg-surface border border-sand rounded-lg shadow-xl w-72 p-3 text-sm"
        >
          <!-- Client -->
          <template v-if="kind === 'client'">
            <div class="flex items-start gap-3 mb-2">
              <span
                class="h-9 w-9 grid place-items-center rounded-full font-semibold text-sm shrink-0"
                :style="{ background: palette.soft, color: palette.text }"
              >{{ initials(data.name) }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-ink truncate">{{ data.name }}</div>
                <div v-if="data.company" class="text-xs text-slate-warm truncate">{{ data.company }}</div>
              </div>
              <StatusBadge :status="data.status" variant="client" />
            </div>
            <div v-if="data.email" class="text-xs text-slate-warm truncate">{{ data.email }}</div>
            <div v-if="data.tags?.length" class="flex items-center gap-1 flex-wrap mt-2">
              <span v-for="t in data.tags" :key="t" class="text-[10px] px-1.5 rounded bg-sand text-ink">#{{ t }}</span>
            </div>
          </template>

          <!-- Project -->
          <template v-else-if="kind === 'project'">
            <div class="flex items-start gap-2 mb-2">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-ink truncate">{{ data.name }}</div>
                <div v-if="data.client_name" class="text-xs text-slate-warm truncate">{{ data.client_name }}</div>
              </div>
              <StatusBadge :status="data.status" variant="project" />
            </div>
            <p v-if="data.description" class="text-xs text-slate-warm line-clamp-2">{{ data.description }}</p>
            <div v-if="data.deadline" class="text-xs text-slate-warm mt-2">Due {{ humanizeDay(data.deadline) }}</div>
          </template>

          <!-- Meeting -->
          <template v-else-if="kind === 'meeting'">
            <div class="font-medium text-ink truncate mb-1">{{ data.title }}</div>
            <div class="text-xs text-slate-warm space-y-0.5">
              <div v-if="data.date">{{ humanizeDate(data.date) }}</div>
              <div v-if="data.client_name">{{ data.client_name }}<span v-if="data.project_name"> · {{ data.project_name }}</span></div>
              <div v-if="data.action_items?.length">
                {{ data.action_items.filter(a => !a.done).length }} open of {{ data.action_items.length }} action items
              </div>
            </div>
          </template>

          <!-- Note -->
          <template v-else-if="kind === 'note'">
            <div class="font-medium text-ink truncate mb-1">{{ data.title }}</div>
            <div v-if="data.universal_tags?.length || data.tags?.length" class="flex items-center gap-1 flex-wrap mt-1">
              <span v-for="t in (data.universal_tags?.length ? data.universal_tags : data.tags)" :key="t" class="text-[10px] px-1.5 rounded bg-sand text-ink">#{{ t }}</span>
            </div>
          </template>

          <RouterLink :to="target" class="block mt-2.5 pt-2 border-t border-sand text-[11px] text-slate-warm hover:text-terracotta">Open →</RouterLink>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.hov-enter-active, .hov-leave-active {
  transition: opacity 140ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.hov-enter-from { opacity: 0; transform: translateY(4px) scale(0.97); }
.hov-leave-to { opacity: 0; transform: translateY(2px) scale(0.98); }
</style>
