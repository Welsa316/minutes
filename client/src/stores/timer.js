import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { timeEntries } from '../api/endpoints.js';

// Holds the single running timer for the active workspace so a floating widget
// can show it on every page. The running state lives in the DB (ended_at IS NULL),
// so it survives reloads and workspace switches — refresh() re-reads it.
export const useTimerStore = defineStore('timer', () => {
  const running = ref(null);
  const now = ref(Date.now());
  let tick = 0;

  const elapsedSec = computed(() => {
    if (!running.value) return 0;
    return Math.max(0, Math.floor((now.value - new Date(running.value.started_at).getTime()) / 1000));
  });

  function startTicking() {
    if (tick) return;
    now.value = Date.now();
    tick = setInterval(() => { now.value = Date.now(); }, 1000);
  }
  function stopTicking() { if (tick) { clearInterval(tick); tick = 0; } }

  let reqId = 0;
  async function refresh() {
    const id = ++reqId;
    try {
      const r = await timeEntries.running();
      if (id !== reqId) return; // a newer refresh (e.g. faster workspace switch) won
      running.value = r;
      running.value ? startTicking() : stopTicking();
    } catch { /* offline — leave as is */ }
  }

  async function start(opts = {}) {
    running.value = await timeEntries.start(opts);
    startTicking();
    return running.value;
  }

  async function stop() {
    const cur = running.value;
    if (!cur) return null;
    const done = await timeEntries.stop(cur.id);
    running.value = null;
    stopTicking();
    return done;
  }

  return { running, elapsedSec, refresh, start, stop };
});
