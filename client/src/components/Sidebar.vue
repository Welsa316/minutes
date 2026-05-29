<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { pinned as pinnedApi } from '../api/endpoints.js';
import { useRecent } from '../composables/useRecent.js';
import { useSettingsStore } from '../stores/settings.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { clientColor, initials } from '../utils/colors.js';
import WorkspaceSwitcher from './WorkspaceSwitcher.vue';

defineEmits(['logout']);

const route = useRoute();
const settings = useSettingsStore();
const ws = useWorkspaceStore();
const { items: recents } = useRecent();
const pinned = ref([]);
const loading = ref(true);

// All possible nav entries. Sidebar shows only those whose key is in the
// active workspace's `sections` list.
const ALL_LINKS = [
  { key: 'dashboard', to: '/', label: 'Dashboard', exact: true, always: true },
  { key: 'clients', to: '/clients', label: 'Clients' },
  { key: 'projects', to: '/projects', label: 'Projects' },
  { key: 'meetings', to: '/meetings', label: 'Meetings' },
  { key: 'notes', to: '/notes', label: 'Notes' },
  { key: 'todos', to: '/todos', label: 'Todos' },
  { key: 'tags', to: '/tags', label: 'Tags' },
];

const links = computed(() => ALL_LINKS.filter((l) => l.always || ws.has(l.key)));

async function loadPinned() {
  loading.value = true;
  try { pinned.value = await pinnedApi.list(); }
  catch { pinned.value = []; }
  loading.value = false;
}

function pathFor(p) { return `/${p.entity_type === 'note' ? 'notes' : p.entity_type + 's'}/${p.entity_id}`; }

function avatar(p) {
  if (p.entity_type === 'client') {
    const palette = clientColor(p.title);
    return { kind: 'circle', text: initials(p.title), bg: palette.soft, color: palette.text };
  }
  return { kind: 'icon', text: p.entity_type === 'project' ? '▤' : p.entity_type === 'meeting' ? '◷' : '✎' };
}

onMounted(loadPinned);
watch(() => route.fullPath, loadPinned);
watch(() => ws.activeId, loadPinned);
</script>

<template>
  <aside class="w-60 shrink-0 border-r border-sand bg-warm flex flex-col">
    <div class="px-2 py-3 border-b border-sand">
      <WorkspaceSwitcher />
    </div>

    <nav class="flex-1 overflow-y-auto py-3 px-3 space-y-1">
      <RouterLink
        v-for="l in links"
        :key="l.key"
        :to="l.to"
        v-slot="{ isActive, isExactActive, href, navigate }"
        custom
      >
        <a
          :href="href"
          @click="navigate"
          :class="[
            'block px-3 py-1.5 rounded-md text-sm transition-colors',
            (l.exact ? isExactActive : isActive)
              ? 'bg-sand text-ink font-medium'
              : 'text-slate-warm hover:bg-sand/50 hover:text-ink',
          ]"
        >{{ l.label }}</a>
      </RouterLink>

      <div v-if="pinned.length" class="pt-3">
        <div class="px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-warm">Pinned</div>
        <RouterLink
          v-for="p in pinned"
          :key="`${p.entity_type}-${p.entity_id}`"
          :to="pathFor(p)"
          class="px-3 py-1.5 rounded-md text-sm text-slate-warm hover:bg-sand/50 hover:text-ink transition-colors flex items-center gap-2 truncate"
        >
          <span
            v-if="avatar(p).kind === 'circle'"
            class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
            :style="{ background: avatar(p).bg, color: avatar(p).color }"
          >{{ avatar(p).text }}</span>
          <span v-else class="w-5 text-center text-slate-warm shrink-0">{{ avatar(p).text }}</span>
          <span class="truncate">{{ p.title }}</span>
        </RouterLink>
      </div>

      <div v-if="recents.length" class="pt-3">
        <div class="px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-warm">Recent</div>
        <RouterLink
          v-for="r in recents"
          :key="`${r.kind}-${r.id}`"
          :to="`/${r.kind === 'note' ? 'notes' : r.kind + 's'}/${r.id}`"
          class="px-3 py-1 rounded-md text-sm text-slate-warm hover:bg-sand/50 hover:text-ink transition-colors flex items-center gap-2 truncate"
        >
          <span class="w-5 text-center text-slate-warm shrink-0 text-xs">{{ r.kind === 'client' ? '◉' : r.kind === 'project' ? '▤' : r.kind === 'meeting' ? '◷' : '✎' }}</span>
          <span class="truncate">{{ r.title }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="p-3 border-t border-sand space-y-2">
      <RouterLink v-if="ws.has('meetings')" to="/meetings/new" class="btn-primary w-full text-sm">+ New meeting</RouterLink>
      <div class="flex items-center gap-1">
        <button class="btn-ghost flex-1 text-sm" @click="$emit('logout')">Sign out</button>
        <button
          class="btn-ghost px-2 text-sm"
          @click="settings.toggleDensity"
          :title="`Density: ${settings.density}`"
        >{{ settings.density === 'compact' ? '≡' : '☰' }}</button>
        <button
          class="btn-ghost px-2 text-sm"
          @click="settings.sound = !settings.sound"
          :title="settings.sound ? 'Sound on' : 'Sound off'"
        >{{ settings.sound ? '♪' : '·' }}</button>
        <button
          class="btn-ghost px-2 text-sm"
          @click="settings.cycleTheme"
          :title="`Theme: ${settings.theme}`"
        >
          <span v-if="settings.theme === 'light'">☀</span>
          <span v-else-if="settings.theme === 'dark'">☾</span>
          <span v-else>⌖</span>
        </button>
      </div>
      <p class="text-[10px] text-slate-warm text-center pt-1">Cmd+K · Cmd+N · ?</p>
    </div>
  </aside>
</template>
