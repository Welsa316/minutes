<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useSettingsStore } from '../stores/settings.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import WorkspaceIcon from './WorkspaceIcon.vue';
import WorkspaceCreate from './WorkspaceCreate.vue';
import {
  LayoutDashboard, Users, FolderKanban, Timer, Receipt, CalendarClock,
  NotebookPen, MessageSquareText, Milestone, ChartColumn, Tag, ListTodo,
  Moon, Sun, LogOut,
} from 'lucide-vue-next';

defineEmits(['logout']);

const router = useRouter();
const settings = useSettingsStore();
const ws = useWorkspaceStore();

const systemDark = ref(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
const isDark = computed(() => settings.theme === 'dark' || (settings.theme === 'system' && systemDark.value));
function toggleTheme() { settings.theme = isDark.value ? 'light' : 'dark'; }

// Per-workspace destinations — only the ones in the active workspace show.
const WORKSPACE_LINKS = [
  { key: 'dashboard', to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, always: true },
  { key: 'clients', to: '/clients', label: 'Clients', icon: Users },
  { key: 'projects', to: '/projects', label: 'Projects', icon: FolderKanban },
  { key: 'time', to: '/time', label: 'Time', icon: Timer },
  { key: 'invoices', to: '/invoices', label: 'Invoices', icon: Receipt },
  { key: 'meetings', to: '/meetings', label: 'Meetings', icon: CalendarClock },
  { key: 'notes', to: '/notes', label: 'Notes', icon: NotebookPen },
  { key: 'feedback', to: '/feedback', label: 'Feedback', icon: MessageSquareText },
  { key: 'roadmap', to: '/roadmap', label: 'Roadmap', icon: Milestone },
  { key: 'metrics', to: '/metrics', label: 'Metrics', icon: ChartColumn },
  { key: 'tags', to: '/tags', label: 'Tags', icon: Tag },
];
const GLOBAL_LINKS = [{ key: 'todos', to: '/todos', label: 'Todos', icon: ListTodo }];
const wsLinks = computed(() => WORKSPACE_LINKS.filter((l) => l.always || ws.has(l.key)));

// Workspace switcher popover
const wsOpen = ref(false);
const wsWrap = ref(null);
const editing = ref(null);
const showCreate = ref(false);
const accent = computed(() => (ws.active?.color ? `#${ws.active.color}` : '#0F1B2D'));
const activeIcon = computed(() => ws.active?.icon || ws.active?.name?.[0] || '?');
function pick(id) { ws.setActive(id); wsOpen.value = false; }
function editWorkspace(w) { wsOpen.value = false; editing.value = w; }
function goPortal() { wsOpen.value = false; router.push('/home'); }

function onDocClick(e) { if (wsWrap.value && !wsWrap.value.contains(e.target)) wsOpen.value = false; }
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
</script>

<template>
  <aside class="rail">
    <RouterLink to="/home" class="logo" title="Home">m</RouterLink>

    <nav class="nav">
      <RouterLink
        v-for="l in wsLinks"
        :key="l.key"
        :to="l.to"
        custom
        v-slot="{ isActive, isExactActive, href, navigate }"
      >
        <a :href="href" @click="navigate" class="item" :class="{ active: l.exact ? isExactActive : isActive }" :title="l.label" :aria-label="l.label">
          <component :is="l.icon" class="w-5 h-5" :stroke-width="1.9" />
        </a>
      </RouterLink>

      <span class="divider" />

      <RouterLink v-for="l in GLOBAL_LINKS" :key="l.key" :to="l.to" custom v-slot="{ isActive, href, navigate }">
        <a :href="href" @click="navigate" class="item" :class="{ active: isActive }" :title="l.label" :aria-label="l.label">
          <component :is="l.icon" class="w-5 h-5" :stroke-width="1.9" />
        </a>
      </RouterLink>
    </nav>

    <div class="bottom">
      <div ref="wsWrap" class="relative">
        <button class="item wsbtn" @click="wsOpen = !wsOpen" :style="{ background: accent }" :title="ws.active?.name || 'Workspace'" :aria-label="ws.active?.name || 'Workspace'">
          <span class="text-warm text-base"><WorkspaceIcon :icon="activeIcon" /></span>
        </button>
        <div v-if="wsOpen" class="pop">
          <div class="pop-head">Workspaces</div>
          <div
            v-for="w in ws.list"
            :key="w.id"
            @click="pick(w.id)"
            :class="['pop-row group/row', w.id === ws.activeId && 'on']"
          >
            <span class="pop-ic text-warm" :style="{ background: w.color ? `#${w.color}` : '#0F1B2D' }"><WorkspaceIcon :icon="w.icon || w.name?.[0]" /></span>
            <span class="flex-1 truncate text-left">{{ w.name }}</span>
            <button type="button" class="edit" @click.stop="editWorkspace(w)" title="Edit workspace">✎</button>
          </div>
          <div class="pop-foot">
            <button type="button" @click="goPortal">⌂ All workspaces</button>
            <button type="button" @click="wsOpen = false; showCreate = true">+ New workspace</button>
          </div>
        </div>
      </div>

      <button class="item" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'" :aria-label="isDark ? 'Light mode' : 'Dark mode'">
        <component :is="isDark ? Sun : Moon" class="w-5 h-5" :stroke-width="1.9" />
      </button>
      <button class="item" @click="$emit('logout')" title="Sign out" aria-label="Sign out">
        <LogOut class="w-5 h-5" :stroke-width="1.9" />
      </button>
    </div>

    <WorkspaceCreate v-if="showCreate" @close="showCreate = false" />
    <WorkspaceCreate v-if="editing" :edit="editing" @close="editing = null" />
  </aside>
</template>

<style scoped>
/* Liquid-glass vertical rail: translucent, blurred, icon-only. */
.rail {
  width: 4rem; flex-shrink: 0; height: 100dvh; z-index: 40;
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  padding: 0.75rem 0;
  background: rgb(var(--c-surface) / 0.55);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-right: 1px solid rgb(var(--c-sand) / 0.6);
}

.logo {
  width: 2.25rem; height: 2.25rem; border-radius: 0.7rem; display: grid; place-items: center;
  background: #C65D3E; color: #FBF8F3; text-decoration: none;
  font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.25rem; font-weight: 600; line-height: 1;
  margin-bottom: 0.75rem; box-shadow: 0 4px 14px rgb(198 93 62 / 0.35);
  transition: transform 0.15s ease;
}
.logo:hover { transform: translateY(-1px); }

.nav { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; width: 100%; overflow-y: auto; overflow-x: clip; }
.bottom { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; width: 100%; }
.divider { width: 1.4rem; height: 1px; background: rgb(var(--c-sand) / 0.8); margin: 0.4rem 0; }

.item {
  position: relative; width: 2.5rem; height: 2.5rem; border-radius: 0.7rem;
  display: grid; place-items: center; cursor: pointer; border: 0; background: transparent;
  color: rgb(var(--c-slate-warm)); transition: color 0.15s, background 0.15s;
}
.item:hover { color: rgb(var(--c-ink)); background: rgb(var(--c-ink) / 0.06); }
.item.active { color: rgb(var(--c-terracotta)); background: rgb(var(--c-terracotta) / 0.12); }
.item.active::before {
  content: ''; position: absolute; left: -0.75rem; top: 50%; transform: translateY(-50%);
  width: 3px; height: 1.4rem; background: rgb(var(--c-terracotta)); border-radius: 0 3px 3px 0;
}
.wsbtn { color: #FBF8F3; box-shadow: 0 2px 8px rgb(0 0 0 / 0.2); }
.wsbtn:hover { background: currentColor; } /* overridden by inline accent; keep hover subtle */

/* Workspace switch popover (escapes the rail to the right). */
.pop {
  position: absolute; bottom: 0; left: calc(100% + 0.6rem); width: 14rem; z-index: 60;
  background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-sand));
  border-radius: 0.6rem; box-shadow: 0 18px 40px rgb(0 0 0 / 0.28); padding: 0.35rem;
}
.pop-head { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em; color: rgb(var(--c-slate-warm)); padding: 0.35rem 0.5rem; }
.pop-row {
  display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.5rem; border-radius: 0.4rem;
  cursor: pointer; font-size: 0.875rem; color: rgb(var(--c-ink));
}
.pop-row:hover { background: rgb(var(--c-sand) / 0.5); }
.pop-row.on { background: rgb(var(--c-sand) / 0.6); }
.pop-ic { width: 1.5rem; height: 1.5rem; border-radius: 0.4rem; display: grid; place-items: center; font-size: 0.8rem; flex-shrink: 0; }
.pop-row .edit { opacity: 0; color: rgb(var(--c-slate-warm)); font-size: 0.8rem; }
.pop-row:hover .edit { opacity: 1; }
.pop-row .edit:hover { color: rgb(var(--c-ink)); }
.pop-foot { border-top: 1px solid rgb(var(--c-sand)); margin-top: 0.25rem; padding-top: 0.25rem; display: flex; flex-direction: column; }
.pop-foot button { text-align: left; font-size: 0.75rem; color: rgb(var(--c-slate-warm)); padding: 0.4rem 0.5rem; border-radius: 0.4rem; }
.pop-foot button:hover { color: rgb(var(--c-ink)); background: rgb(var(--c-sand) / 0.5); }
</style>
