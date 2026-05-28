<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { isTyping } from '../composables/useShortcuts.js';

const open = ref(false);

const SECTIONS = [
  {
    title: 'Global',
    items: [
      ['⌘K', 'Open command palette'],
      ['⌘N', 'New meeting'],
      ['/', 'Focus search'],
      ['?', 'This help'],
    ],
  },
  {
    title: 'List navigation',
    items: [
      ['j', 'Next row'],
      ['k', 'Previous row'],
      ['↵', 'Open selected'],
      ['c', 'Focus inline-create'],
    ],
  },
  {
    title: 'Editor',
    items: [
      ['/', 'Block menu (heading, list, divider…)'],
      ['@', 'Mention a client or project'],
    ],
  },
];

function show() { open.value = true; }
function hide() { open.value = false; }

function onKey(e) {
  if (e.key === 'Escape' && open.value) { e.preventDefault(); hide(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTyping(e.target)) return;
  if (e.key === '?') { e.preventDefault(); open.value ? hide() : show(); }
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="cs">
      <div
        v-if="open"
        class="fixed inset-0 z-[55] flex items-center justify-center px-4"
        @mousedown.self="hide"
      >
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="hide" />
        <div class="relative w-full max-w-md bg-surface border border-sand rounded-xl shadow-2xl overflow-hidden">
          <div class="px-5 py-3 border-b border-sand flex items-center justify-between">
            <span class="font-serif text-lg text-ink">Keyboard shortcuts</span>
            <kbd class="text-[10px] text-slate-warm border border-sand rounded px-1.5 py-0.5">esc</kbd>
          </div>
          <div class="p-5 space-y-4">
            <section v-for="s in SECTIONS" :key="s.title">
              <h3 class="text-[10px] uppercase tracking-wider text-slate-warm mb-1.5">{{ s.title }}</h3>
              <ul class="space-y-1">
                <li v-for="(it, idx) in s.items" :key="idx" class="flex items-center justify-between text-sm">
                  <span class="text-ink">{{ it[1] }}</span>
                  <kbd class="text-xs text-slate-warm border border-sand rounded px-1.5 py-0.5">{{ it[0] }}</kbd>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cs-enter-active, .cs-leave-active { transition: opacity 180ms ease; }
.cs-enter-active > div.relative, .cs-leave-active > div.relative {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.cs-enter-from > div.relative { transform: scale(0.96); opacity: 0; }
.cs-leave-to > div.relative { transform: scale(0.98); opacity: 0; }
.cs-enter-from, .cs-leave-to { opacity: 0; }
</style>
