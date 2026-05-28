<script setup>
defineProps({
  icon: { type: String, default: '○' },
  title: { type: String, required: true },
  hint: { type: String, default: '' },
  shortcut: { type: String, default: '' },
});
</script>

<template>
  <div class="text-center py-16 px-4 max-w-md mx-auto">
    <div
      class="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-2xl bg-sand/60 text-3xl text-slate-warm font-serif"
      aria-hidden
    >{{ icon }}</div>
    <h3 class="font-serif text-xl text-ink mb-1">{{ title }}</h3>
    <p v-if="hint" class="text-sm text-slate-warm">{{ hint }}</p>
    <p v-if="shortcut" class="text-xs text-slate-warm mt-3">
      Press <kbd class="border border-sand rounded px-1.5 py-0.5 text-[10px] mx-0.5">{{ shortcut }}</kbd> to add one.
    </p>
  </div>
</template>
