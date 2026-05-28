<script setup>
import { RouterView } from 'vue-router';
import CommandPalette from './components/CommandPalette.vue';
import QuickAdd from './components/QuickAdd.vue';
import Toaster from './components/Toaster.vue';
</script>

<template>
  <RouterView />
  <CommandPalette />
  <QuickAdd />
  <Toaster />
</template>
