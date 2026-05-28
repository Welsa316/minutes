<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useToastStore } from '../stores/toast.js';
const toast = useToastStore();

// Re-render every 100ms to animate the countdown ring without per-toast reactivity overhead.
const now = ref(Date.now());
let interval;
onMounted(() => { interval = setInterval(() => { now.value = Date.now(); }, 100); });
onBeforeUnmount(() => clearInterval(interval));

function fraction(t) {
  if (!t.countdownStart || !t.ttl) return 1;
  const remaining = t.ttl - (now.value - t.countdownStart);
  return Math.max(0, Math.min(1, remaining / t.ttl));
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="pointer-events-auto px-4 py-2.5 rounded-md shadow-lg text-sm flex items-center gap-3 min-w-[16rem] max-w-sm"
        :class="t.kind === 'success' ? 'bg-[#3F6B4C] text-warm' : t.kind === 'error' ? 'bg-terracotta text-warm' : 'bg-ink text-warm'"
      >
        <span class="flex-1">{{ t.message }}</span>

        <template v-if="t.action">
          <button
            type="button"
            @click="toast.runAction(t.id)"
            class="relative inline-flex items-center justify-center font-medium hover:opacity-80 transition-opacity pr-1"
          >
            <svg class="absolute -left-1 h-5 w-5 -rotate-90" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-opacity="0.3" stroke-width="2" fill="none" />
              <circle
                cx="10" cy="10" r="8"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-dasharray="50.265"
                :stroke-dashoffset="50.265 * (1 - fraction(t))"
                stroke-linecap="round"
              />
            </svg>
            <span class="pl-5">{{ t.action.label }}</span>
          </button>
        </template>

        <button
          type="button"
          @click="toast.dismiss(t.id)"
          class="opacity-60 hover:opacity-100 -mr-1"
          title="Dismiss"
        >×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;
}
.toast-enter-from { transform: translateY(8px) scale(0.96); opacity: 0; }
.toast-leave-to { transform: translateX(20px) scale(0.96); opacity: 0; }
</style>
