<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  command: { type: Function, required: true },
});

const selected = ref(0);
watch(() => props.items, () => { selected.value = 0; });

defineExpose({
  onKeyDown({ event }) {
    if (event.key === 'ArrowUp') { selected.value = (selected.value + props.items.length - 1) % props.items.length; return true; }
    if (event.key === 'ArrowDown') { selected.value = (selected.value + 1) % props.items.length; return true; }
    if (event.key === 'Enter') {
      const item = props.items[selected.value];
      if (item) props.command(item);
      return true;
    }
    return false;
  },
});
</script>

<template>
  <div class="bg-warm border border-sand rounded-md shadow-lg overflow-hidden min-w-[14rem] py-1 max-h-72 overflow-y-auto">
    <button
      v-for="(item, idx) in items"
      :key="item.label"
      type="button"
      @click="command(item)"
      @mousemove="selected = idx"
      :class="[
        'block w-full text-left px-3 py-1.5 text-sm flex items-center gap-3',
        idx === selected ? 'bg-sand text-ink' : 'text-ink hover:bg-sand/50'
      ]"
    >
      <span class="text-slate-warm w-5 text-center text-xs">{{ item.icon }}</span>
      <span class="flex-1">{{ item.label }}</span>
      <span v-if="item.hint" class="text-[10px] text-slate-warm">{{ item.hint }}</span>
    </button>
    <p v-if="!items.length" class="px-3 py-2 text-xs text-slate-warm">No matches</p>
  </div>
</template>
