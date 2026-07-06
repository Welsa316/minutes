<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useWorkspaceStore } from '../stores/workspace.js';
import WorkspaceCreate from './WorkspaceCreate.vue';

const router = useRouter();
const ws = useWorkspaceStore();
const open = ref(false);
const wrapper = ref(null);
const showCreate = ref(false);

function goHome() { open.value = false; router.push('/home'); }

const accent = computed(() => ws.active?.color ? `#${ws.active.color}` : '#0F1B2D');
const initial = computed(() => ws.active?.icon || ws.active?.name?.[0] || '?');

function toggle() { open.value = !open.value; }
function pick(id) { ws.setActive(id); open.value = false; }

function openCreate() {
  open.value = false;
  showCreate.value = true;
}

function onDocClick(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) open.value = false;
}
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
</script>

<template>
  <div ref="wrapper" class="relative">
    <button
      type="button"
      @click="toggle"
      class="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sand/50 transition-colors group"
    >
      <span
        class="h-8 w-8 grid place-items-center rounded-md text-warm font-serif text-base shrink-0"
        :style="{ background: accent }"
      >{{ initial }}</span>
      <div class="flex-1 min-w-0 text-left">
        <div class="font-serif text-base text-ink truncate leading-tight">{{ ws.active?.name || 'Minutes' }}</div>
        <div class="text-[10px] text-slate-warm uppercase tracking-wider">workspace</div>
      </div>
      <span class="text-slate-warm text-xs group-hover:text-ink">▾</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-full mt-1 bg-surface border border-sand rounded-md shadow-lg z-30 py-1"
    >
      <button
        v-for="w in ws.list"
        :key="w.id"
        type="button"
        @click="pick(w.id)"
        :class="['w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-sand/50', w.id === ws.activeId && 'bg-sand/40']"
      >
        <span
          class="h-6 w-6 grid place-items-center rounded text-warm font-serif text-xs shrink-0"
          :style="{ background: w.color ? `#${w.color}` : '#0F1B2D' }"
        >{{ w.icon || w.name?.[0] }}</span>
        <span class="flex-1 truncate">{{ w.name }}</span>
        <span v-if="(Number(w.client_count) + Number(w.project_count) + Number(w.meeting_count) + Number(w.note_count)) > 0" class="text-[10px] text-slate-warm tabular-nums">{{ Number(w.client_count) + Number(w.project_count) + Number(w.meeting_count) + Number(w.note_count) }}</span>
      </button>

      <div class="border-t border-sand mt-1 pt-1">
        <button
          type="button"
          @click="goHome"
          class="w-full px-3 py-2 text-left text-xs text-slate-warm hover:text-ink hover:bg-sand/50"
        >⌂ All workspaces</button>
        <button
          type="button"
          @click="openCreate"
          class="w-full px-3 py-2 text-left text-xs text-slate-warm hover:text-ink hover:bg-sand/50"
        >+ New workspace</button>
      </div>
    </div>

    <WorkspaceCreate v-if="showCreate" @close="showCreate = false" />
  </div>
</template>
