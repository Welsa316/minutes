<script setup>
const props = defineProps({ modelValue: { type: String, default: 'doc' } });
const emit = defineEmits(['update:modelValue']);
function set(v) { if (v !== props.modelValue) emit('update:modelValue', v); }
</script>

<template>
  <div class="inline-flex items-center gap-1 text-sm shrink-0">
    <button
      type="button"
      @click="set('doc')"
      :class="['px-2.5 py-1 rounded transition-colors', modelValue !== 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
    >Doc</button>
    <button
      type="button"
      @click="set('board')"
      :class="['px-2.5 py-1 rounded transition-colors', modelValue === 'board' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
    >Board</button>
  </div>
</template>
