<script setup>
import { onMounted, watch } from 'vue';
import { useRouter, RouterView } from 'vue-router';
import CommandPalette from './components/CommandPalette.vue';
import QuickAdd from './components/QuickAdd.vue';
import Toaster from './components/Toaster.vue';
import ShortcutsOverlay from './components/ShortcutsOverlay.vue';
import { useSettingsStore } from './stores/settings.js';
import { useAuthStore } from './stores/auth.js';
import { useWorkspaceStore } from './stores/workspace.js';

// Initialize so the theme class lands on <html> as early as possible.
useSettingsStore();

const auth = useAuthStore();
const ws = useWorkspaceStore();
const router = useRouter();

// Pull workspaces the moment the user is authed.
async function bootstrap() {
  if (!auth.checked) await auth.fetchMe();
  if (auth.isAuthenticated && !ws.list.length) await ws.load();
}

onMounted(bootstrap);
watch(() => auth.user, bootstrap);

// When the active workspace flips, navigate to its first available section so
// the user never lands on a route that the workspace doesn't enable.
watch(() => ws.activeId, () => {
  if (!ws.active) return;
  const sections = ws.active.sections || [];
  const path = router.currentRoute.value.path;
  const isRoot = path === '/';
  const isOnEnabled = sections.some((s) => path === `/${s}` || path.startsWith(`/${s}/`));
  if (!isRoot && !isOnEnabled) {
    router.replace(sections.includes('notes') ? '/notes' : '/');
  }
});
</script>

<template>
  <RouterView />
  <CommandPalette />
  <QuickAdd />
  <Toaster />
  <ShortcutsOverlay />
</template>
