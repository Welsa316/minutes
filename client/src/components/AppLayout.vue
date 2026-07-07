<script setup>
import { watch } from 'vue';
import { useRouter, RouterView } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useUiStore } from '../stores/ui.js';
import Sidebar from './Sidebar.vue';
import TopNav from './TopNav.vue';
import TimerWidget from './TimerWidget.vue';

const router = useRouter();
const auth = useAuthStore();
const ws = useWorkspaceStore();
const ui = useUiStore();

async function onLogout() {
  await auth.logout();
  // Hard navigation (not router.replace) so all in-memory singletons — the
  // recents ref, Pinia stores — reset and the next account starts clean.
  window.location.assign('/login');
}

// Close the mobile drawer whenever the route changes.
watch(() => router.currentRoute.value.fullPath, () => ui.closeSidebar());
</script>

<template>
  <div class="min-h-dvh flex bg-warm text-ink">
    <Sidebar @logout="onLogout" />

    <div class="flex-1 flex flex-col min-w-0">
      <TopNav />
      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <!-- Key includes workspace id so switching workspaces fully re-mounts the view.
                 Notes share one key across /notes/* so the two-pane layout persists
                 (the rail stays put) while you switch between notes. -->
            <component
              :is="Component"
              :key="route.path.startsWith('/notes') ? `${ws.activeId}:notes` : `${ws.activeId}:${route.fullPath}`"
            />
          </Transition>
        </RouterView>
      </main>
    </div>

    <TimerWidget />
  </div>
</template>

<style scoped>
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 200ms ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
</style>
