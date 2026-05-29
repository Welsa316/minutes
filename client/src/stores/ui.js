import { defineStore } from 'pinia';
import { ref } from 'vue';

// Layout chrome state — currently just the mobile sidebar drawer.
export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false);
  function openSidebar() { sidebarOpen.value = true; }
  function closeSidebar() { sidebarOpen.value = false; }
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }
  return { sidebarOpen, openSidebar, closeSidebar, toggleSidebar };
});
