<script setup>
defineProps({
  count: { type: Number, default: 0 },
  actions: { type: Array, default: () => [] }, // [{ label, run, icon, kind }]
});
const emit = defineEmits(['clear']);
</script>

<template>
  <Teleport to="body">
    <Transition name="bulk">
      <div
        v-if="count > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink text-warm rounded-full shadow-2xl px-3 py-2 flex items-center gap-2 text-sm"
      >
        <span class="tabular-nums px-3 py-1 rounded-full bg-warm/10 font-medium">{{ count }} selected</span>
        <button
          v-for="a in actions"
          :key="a.label"
          @click="a.run()"
          :class="['px-3 py-1.5 rounded-full hover:bg-warm/10 transition-colors flex items-center gap-1.5', a.kind === 'danger' && 'text-terracotta']"
        >
          <span v-if="a.icon">{{ a.icon }}</span>
          <span>{{ a.label }}</span>
        </button>
        <button
          @click="$emit('clear')"
          class="px-2.5 py-1.5 rounded-full hover:bg-warm/10 text-xs opacity-60"
          title="Clear selection (Esc)"
        >×</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bulk-enter-active, .bulk-leave-active {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;
}
.bulk-enter-from { transform: translate(-50%, 16px) scale(0.96); opacity: 0; }
.bulk-leave-to { transform: translate(-50%, 16px) scale(0.96); opacity: 0; }
</style>
