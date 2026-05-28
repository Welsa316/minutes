<script setup>
defineProps({
  rows: { type: Number, default: 5 },
  variant: { type: String, default: 'list' }, // list | cards | dashboard
});
</script>

<template>
  <!-- List rows -->
  <ul v-if="variant === 'list'" class="border border-sand rounded-lg overflow-hidden bg-surface">
    <li
      v-for="i in rows"
      :key="i"
      :class="['px-4 py-3 flex items-center gap-4', i > 1 && 'border-t border-sand/60']"
    >
      <div class="sk h-5 w-5 rounded-full" />
      <div class="flex-1 space-y-2">
        <div class="sk h-3.5 rounded" :style="{ width: 30 + (i * 11) % 50 + '%' }" />
        <div class="sk h-3 rounded" :style="{ width: 20 + (i * 13) % 30 + '%' }" />
      </div>
      <div class="sk h-3.5 w-16 rounded" />
      <div class="sk h-5 w-14 rounded" />
    </li>
  </ul>

  <!-- Card grid (for notes) -->
  <div v-else-if="variant === 'cards'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div v-for="i in rows" :key="i" class="card space-y-3">
      <div class="sk h-4 w-1/2 rounded" />
      <div class="sk h-3 w-full rounded" />
      <div class="sk h-3 w-5/6 rounded" />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <div class="sk h-4 w-12 rounded" />
          <div class="sk h-4 w-10 rounded" />
        </div>
        <div class="sk h-3 w-16 rounded" />
      </div>
    </div>
  </div>

  <!-- Dashboard panels -->
  <div v-else-if="variant === 'dashboard'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div v-for="i in 3" :key="i" class="card space-y-3">
      <div class="sk h-4 w-1/2 rounded" />
      <div v-for="j in 3" :key="j" class="space-y-1.5">
        <div class="sk h-3.5 rounded" :style="{ width: 50 + ((j * i * 17) % 40) + '%' }" />
        <div class="sk h-2.5 w-1/3 rounded" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk {
  position: relative;
  overflow: hidden;
  background: rgb(var(--c-sand) / 0.5);
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgb(var(--c-warm) / 0.5) 50%,
    transparent 100%);
  animation: shimmer 1.4s infinite;
}
.dark .sk::after {
  background: linear-gradient(90deg,
    transparent 0%,
    rgb(var(--c-surface) / 0.7) 50%,
    transparent 100%);
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .sk::after { animation: none; }
}
</style>
