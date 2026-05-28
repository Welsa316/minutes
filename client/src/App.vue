<script setup>
import { RouterView } from 'vue-router';
import CommandPalette from './components/CommandPalette.vue';
import QuickAdd from './components/QuickAdd.vue';
import Toaster from './components/Toaster.vue';
import ShortcutsOverlay from './components/ShortcutsOverlay.vue';
import { useSettingsStore } from './stores/settings.js';

// Initialize so the theme class lands on <html> as early as possible.
useSettingsStore();
</script>

<template>
  <RouterView />
  <CommandPalette />
  <QuickAdd />
  <Toaster />
  <ShortcutsOverlay />
</template>
