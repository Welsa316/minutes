<script setup>
import { computed } from 'vue';
import { clientColor } from '../utils/colors.js';

const props = defineProps({
  tag: { type: [String, Object], required: true }, // string or { name, color }
  size: { type: String, default: 'sm' },           // sm | xs
  removable: { type: Boolean, default: false },
});
const emit = defineEmits(['remove']);

const name = computed(() => (typeof props.tag === 'string' ? props.tag : props.tag.name));
const palette = computed(() => clientColor(name.value));
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded font-medium',
      size === 'xs' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
    ]"
    :style="{ background: palette.soft, color: palette.text }"
  >
    <span>#{{ name }}</span>
    <button
      v-if="removable"
      type="button"
      @click.stop="$emit('remove', name)"
      class="opacity-60 hover:opacity-100 -mr-0.5"
      title="Remove tag"
    >×</button>
  </span>
</template>
