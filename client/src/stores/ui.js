import { defineStore } from 'pinia';
import { ref } from 'vue';

// Layout chrome state — the mobile sidebar drawer + the first-run onboarding gate.
export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false);
  function openSidebar() { sidebarOpen.value = true; }
  function closeSidebar() { sidebarOpen.value = false; }
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }

  // Shown when an authed user has zero workspaces (fresh account). Blocks the
  // app until they create their first workspace.
  const onboarding = ref(false);
  function openOnboarding() { onboarding.value = true; }
  function closeOnboarding() { onboarding.value = false; }

  return {
    sidebarOpen, openSidebar, closeSidebar, toggleSidebar,
    onboarding, openOnboarding, closeOnboarding,
  };
});
