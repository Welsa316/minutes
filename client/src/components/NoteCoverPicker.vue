<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { COVERS, COVER_KEYS } from '../utils/noteCovers.js';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const wrap = ref(null);

function pick(k) { emit('update:modelValue', k); open.value = false; }
function clear() { emit('update:modelValue', ''); open.value = false; }

function onDoc(e) { if (wrap.value && !wrap.value.contains(e.target)) open.value = false; }
onMounted(() => document.addEventListener('mousedown', onDoc));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc));
</script>

<template>
  <div ref="wrap" class="relative">
    <button
      type="button"
      @click="open = !open"
      class="text-xs text-slate-warm hover:text-ink transition-colors"
    >{{ modelValue ? 'Change cover' : '＋ Cover' }}</button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 z-30 w-56 bg-surface border border-sand rounded-lg shadow-xl p-2"
    >
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="k in COVER_KEYS"
          :key="k"
          type="button"
          @click="pick(k)"
          :style="{ backgroundImage: COVERS[k] }"
          :class="['h-9 rounded-md border transition-transform hover:scale-[1.04]', modelValue === k ? 'border-terracotta ring-1 ring-terracotta' : 'border-black/10']"
          :title="k"
        />
      </div>
      <button
        v-if="modelValue"
        type="button"
        @click="clear"
        class="mt-1.5 w-full text-left text-xs text-slate-warm hover:text-ink px-1 py-1 rounded hover:bg-sand/50"
      >Remove cover</button>
    </div>
  </div>
</template>
