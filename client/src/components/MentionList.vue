<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  command: { type: Function, required: true },
});

const selected = ref(0);

watch(() => props.items, () => { selected.value = 0; });

function up() { selected.value = (selected.value + props.items.length - 1) % props.items.length; }
function down() { selected.value = (selected.value + 1) % props.items.length; }
function enter() {
  const item = props.items[selected.value];
  if (item) props.command({ id: item.id, label: item.label, kind: item.kind });
}

defineExpose({
  onKeyDown({ event }) {
    if (event.key === 'ArrowUp') { up(); return true; }
    if (event.key === 'ArrowDown') { down(); return true; }
    if (event.key === 'Enter') { enter(); return true; }
    return false;
  },
});
</script>

<template>
  <div class="bg-warm border border-sand rounded-md shadow-lg overflow-hidden min-w-[16rem] py-1">
    <button
      v-for="(item, idx) in items"
      :key="`${item.kind}-${item.id}`"
      type="button"
      @click="command({ id: item.id, label: item.label, kind: item.kind })"
      @mousemove="selected = idx"
      :class="[
        'block w-full text-left px-3 py-1.5 text-sm flex items-center gap-2',
        idx === selected ? 'bg-sand text-ink' : 'text-ink hover:bg-sand/50'
      ]"
    >
      <span class="text-slate-warm w-4 text-center text-xs">{{ item.kind === 'client' ? '◉' : '▤' }}</span>
      <span class="flex-1 truncate">{{ item.label }}</span>
      <span class="text-xs text-slate-warm capitalize">{{ item.kind }}</span>
    </button>
    <p v-if="!items.length" class="px-3 py-2 text-xs text-slate-warm">No matches</p>
  </div>
</template>
