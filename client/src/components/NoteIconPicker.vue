<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const wrap = ref(null);

// A curated, work-flavored set — no dependency, covers the common cases.
const EMOJI = [
  '📝','📌','💡','✅','⭐','🔥','📎','📋','🗒️','📁','🎯','🚀',
  '💬','📅','⏰','🏷️','🔑','📈','🧩','☕','🌱','🐛','⚙️','✨',
  '❤️','⚡','🧠','🔒','🎨','📷','🗓️','🧾',
];

function pick(e) { emit('update:modelValue', e); open.value = false; }
function clear() { emit('update:modelValue', ''); open.value = false; }

function onDoc(e) { if (wrap.value && !wrap.value.contains(e.target)) open.value = false; }
onMounted(() => document.addEventListener('mousedown', onDoc));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc));
</script>

<template>
  <div ref="wrap" class="relative shrink-0">
    <button
      type="button"
      @click="open = !open"
      class="h-9 w-9 grid place-items-center rounded-lg text-xl hover:bg-sand/60 transition-colors"
      :title="modelValue ? 'Change icon' : 'Add icon'"
    >
      <span v-if="modelValue">{{ modelValue }}</span>
      <span v-else class="text-slate-warm text-base">☺</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full mt-1 z-30 w-64 bg-surface border border-sand rounded-lg shadow-xl p-2"
    >
      <div class="grid grid-cols-8 gap-0.5">
        <button
          v-for="e in EMOJI"
          :key="e"
          type="button"
          @click="pick(e)"
          class="h-7 w-7 grid place-items-center rounded hover:bg-sand/70 text-lg"
        >{{ e }}</button>
      </div>
      <button
        v-if="modelValue"
        type="button"
        @click="clear"
        class="mt-1.5 w-full text-left text-xs text-slate-warm hover:text-ink px-1 py-1 rounded hover:bg-sand/50"
      >Remove icon</button>
    </div>
  </div>
</template>
