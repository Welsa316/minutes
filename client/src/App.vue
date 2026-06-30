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

// When the active workspace flips, only bounce off a module's *list* page if
// that module isn't enabled here — detail pages, the global dashboard, and
// Todos stay put. The dashboard is global, so it's always a safe landing spot.
const MODULE_LIST_PATHS = ['/clients', '/projects', '/meetings', '/notes', '/tags'];
watch(() => ws.activeId, () => {
  if (!ws.active) return;
  const sections = ws.active.sections || [];
  const path = router.currentRoute.value.path;
  if (MODULE_LIST_PATHS.includes(path) && !sections.includes(path.slice(1))) {
    router.replace('/');
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
