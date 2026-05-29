<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useWorkspaceStore } from '../stores/workspace.js';

const ws = useWorkspaceStore();
const open = ref(false);
const wrapper = ref(null);

const accent = computed(() => ws.active?.color ? `#${ws.active.color}` : '#0F1B2D');
const initial = computed(() => ws.active?.icon || ws.active?.name?.[0] || '?');

function toggle() { open.value = !open.value; }
function pick(id) { ws.setActive(id); open.value = false; }

const newName = ref('');
const creating = ref(false);
const adding = ref(false);
async function createWorkspace() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await ws.create({ name, slug, icon: name[0].toUpperCase(), sections: ['notes', 'todos'] });
    newName.value = '';
    adding.value = false;
    open.value = false;
  } finally { creating.value = false; }
}

function onDocClick(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) {
    open.value = false;
    adding.value = false;
  }
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
          v-if="!adding"
          type="button"
          @click="adding = true"
          class="w-full px-3 py-2 text-left text-xs text-slate-warm hover:text-ink hover:bg-sand/50"
        >+ New workspace</button>
        <form v-else @submit.prevent="createWorkspace" class="px-2 py-1 flex items-center gap-1">
          <input
            v-model="newName"
            autofocus
            placeholder="Workspace name"
            @keydown.escape="adding = false; newName = ''"
            class="flex-1 bg-transparent text-sm focus:outline-none px-2 py-1 border border-sand rounded"
          />
          <button type="submit" :disabled="!newName.trim() || creating" class="text-xs text-terracotta disabled:opacity-50 px-1">Add</button>
        </form>
      </div>
    </div>
  </div>
</template>
