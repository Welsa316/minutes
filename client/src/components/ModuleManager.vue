<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useWorkspaceStore, MODULES } from '../stores/workspace.js';

const ws = useWorkspaceStore();
const open = ref(false);
const wrap = ref(null);
const busy = ref('');

const enabled = computed(() => new Set(ws.active?.sections || []));

async function toggle(key) {
  if (busy.value) return;
  busy.value = key;
  try { await ws.toggleModule(key); }
  finally { busy.value = ''; }
}

function onDocClick(e) {
  if (wrap.value && !wrap.value.contains(e.target)) open.value = false;
}
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
</script>

<template>
  <div ref="wrap" class="relative">
    <button
      @click="open = !open"
      :class="[
        'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
        open ? 'bg-sand/60 text-ink' : 'text-slate-warm hover:bg-sand/50 hover:text-ink',
      ]"
    >
      <span class="text-base leading-none">+</span>
      <span>Add module</span>
    </button>

    <Transition name="mm">
      <div
        v-if="open"
        class="absolute left-0 right-0 mt-1 bg-surface border border-sand rounded-lg shadow-xl z-30 p-1.5"
      >
        <div class="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-slate-warm">
          Modules in {{ ws.active?.name || 'workspace' }}
        </div>
        <button
          v-for="m in MODULES"
          :key="m.key"
          type="button"
          @click="toggle(m.key)"
          :disabled="busy === m.key"
          class="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-sm text-ink hover:bg-sand/50 transition-colors disabled:opacity-50"
        >
          <span>{{ m.label }}</span>
          <span
            :class="[
              'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] shrink-0 transition-colors',
              enabled.has(m.key) ? 'bg-terracotta text-white' : 'border border-sand text-transparent',
            ]"
          >✓</span>
        </button>
        <p class="px-2 pt-1.5 pb-1 text-[10px] text-slate-warm leading-snug">
          Removing a module hides its tab — your data stays.
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mm-enter-active, .mm-leave-active { transition: opacity 140ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1); }
.mm-enter-from, .mm-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
