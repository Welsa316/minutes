<script setup>
import { useToastStore } from '../stores/toast.js';
const toast = useToastStore();

const kindClass = {
  info: 'bg-ink text-warm',
  success: 'bg-forest text-warm',
  error: 'bg-terracotta text-warm',
};
const forest = '#3F6B4C'; // matches utils/colors palette
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="pointer-events-auto px-4 py-2.5 rounded-md shadow-lg text-sm flex items-center gap-3 max-w-sm cursor-pointer"
        :class="t.kind === 'success' ? 'bg-[#3F6B4C] text-warm' : t.kind === 'error' ? 'bg-terracotta text-warm' : 'bg-ink text-warm'"
        @click="toast.dismiss(t.id)"
      >
        <span class="flex-1">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;
}
.toast-enter-from {
  transform: translateY(8px) scale(0.96);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(20px) scale(0.96);
  opacity: 0;
}
</style>
