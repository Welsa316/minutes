<script setup>
import { useRouter, RouterView } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import Sidebar from './Sidebar.vue';
import TopNav from './TopNav.vue';

const router = useRouter();
const auth = useAuthStore();
const ws = useWorkspaceStore();

async function onLogout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <div class="min-h-dvh flex bg-warm text-ink">
    <Sidebar @logout="onLogout" />
    <div class="flex-1 flex flex-col min-w-0">
      <TopNav />
      <main class="flex-1 p-6 lg:p-8 overflow-y-auto">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <!-- Key includes workspace id so switching workspaces fully re-mounts the view. -->
            <component :is="Component" :key="`${ws.activeId}:${route.fullPath}`" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
