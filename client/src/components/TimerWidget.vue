<script setup>
import { onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useTimerStore } from '../stores/timer.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useToastStore } from '../stores/toast.js';

const timer = useTimerStore();
const ws = useWorkspaceStore();
const toast = useToastStore();

const label = computed(() => {
  const s = timer.elapsedSec;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});
const context = computed(() => timer.running?.project_name || timer.running?.client_name || 'Timer');

async function stop() {
  try { await timer.stop(); toast.success('Timer stopped'); }
  catch { toast.error('Couldn’t stop the timer'); }
}

onMounted(() => timer.refresh());
watch(() => ws.activeId, () => timer.refresh());
</script>

<template>
  <Transition name="timer-pop">
    <div v-if="timer.running" class="timer-widget">
      <span class="dot" aria-hidden="true" />
      <RouterLink to="/time" class="body" title="Open time tracking">
        <span class="time tabular-nums">{{ label }}</span>
        <span class="ctx">{{ context }}</span>
      </RouterLink>
      <button class="stop" @click="stop">Stop</button>
    </div>
  </Transition>
</template>

<style scoped>
.timer-widget {
  position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  z-index: 40; display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.6rem 0.5rem 0.85rem; border-radius: 999px;
  background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-sand));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}
.dot {
  width: 8px; height: 8px; border-radius: 50%; background: rgb(var(--c-terracotta));
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.body { display: flex; align-items: baseline; gap: 0.5rem; text-decoration: none; }
.time { font-variant-numeric: tabular-nums; font-weight: 600; color: rgb(var(--c-ink)); font-size: 0.95rem; }
.ctx { font-size: 0.8rem; color: rgb(var(--c-slate-warm)); max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stop {
  font-size: 0.8rem; font-weight: 500; color: rgb(var(--c-terracotta));
  background: rgb(var(--c-terracotta) / 0.1); border: 0; cursor: pointer;
  padding: 0.25rem 0.7rem; border-radius: 999px; transition: background 0.15s;
}
.stop:hover { background: rgb(var(--c-terracotta) / 0.2); }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }

.timer-pop-enter-active, .timer-pop-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.timer-pop-enter-from, .timer-pop-leave-to { opacity: 0; transform: translate(-50%, 1rem); }
</style>
