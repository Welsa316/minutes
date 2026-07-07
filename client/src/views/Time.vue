<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { timeEntries, clients as clientsApi, projects as projectsApi } from '../api/endpoints.js';
import ClientChip from '../components/ClientChip.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { useTimerStore } from '../stores/timer.js';
import { useToastStore } from '../stores/toast.js';

const timer = useTimerStore();
const toast = useToastStore();

const entries = ref([]);
const clients = ref([]);
const projects = ref([]);
const loading = ref(true);

function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const form = reactive({ project_id: '', client_id: '', note: '', billable: true, dur: '', date: localToday() });

const runLabel = computed(() => {
  const s = timer.elapsedSec;
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});

// Parse "1h30m", "90", "1.5h", "1:30" → minutes.
function parseDuration(str) {
  if (!str) return 0;
  const s = String(str).trim().toLowerCase();
  if (/^\d+:\d{1,2}$/.test(s)) { const [h, m] = s.split(':'); return (+h) * 60 + (+m); }
  let mins = 0, matched = false;
  const h = s.match(/([\d.]+)\s*h/); if (h) { mins += parseFloat(h[1]) * 60; matched = true; }
  const m = s.match(/([\d.]+)\s*m/); if (m) { mins += parseFloat(m[1]); matched = true; }
  if (!matched) { const n = parseFloat(s); if (!Number.isNaN(n)) mins = n; }
  return Math.round(mins);
}
function fmtDuration(mins) {
  mins = Math.round(mins || 0);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function fmtHours(mins) { return `${(mins / 60).toFixed(1)}h`; }

// Anchor a picked calendar date to LOCAL noon before sending, so it round-trips to
// the same day/week in the user's timezone (a bare date would be read as UTC
// midnight and slip a day earlier for anyone west of UTC).
function dateToInstant(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

const completed = computed(() => entries.value.filter((e) => e.ended_at));

function startOfWeek() {
  const x = new Date();
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
const weekMinutes = computed(() => {
  const ws = startOfWeek();
  return completed.value.filter((e) => new Date(e.started_at) >= ws).reduce((s, e) => s + (e.minutes || 0), 0);
});
const weekBillable = computed(() => {
  const ws = startOfWeek();
  return completed.value.filter((e) => new Date(e.started_at) >= ws && e.billable).reduce((s, e) => s + (e.minutes || 0), 0);
});

const byDay = computed(() => {
  const groups = new Map();
  for (const e of completed.value) {
    const key = new Date(e.started_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items, total: items.reduce((s, e) => s + (e.minutes || 0), 0) }));
});

async function reload() { entries.value = await timeEntries.list(); }
async function load() {
  loading.value = true;
  const [e, c, p] = await Promise.all([timeEntries.list(), clientsApi.list(), projectsApi.list()]);
  entries.value = e; clients.value = c; projects.value = p;
  loading.value = false;
}

async function start() {
  try {
    await timer.start({ project_id: form.project_id || null, client_id: form.client_id || null, note: form.note || null, billable: form.billable });
    form.note = '';
    await reload();
  } catch { toast.error('Couldn’t start the timer'); }
}
async function stop() {
  try { await timer.stop(); await reload(); }
  catch { toast.error('Couldn’t stop the timer'); }
}
async function logManual() {
  const mins = parseDuration(form.dur);
  if (!mins) { toast.error('Enter a duration like 1h30m or 90'); return; }
  try {
    await timeEntries.create({
      minutes: mins, started_at: dateToInstant(form.date),
      project_id: form.project_id || null, client_id: form.client_id || null,
      note: form.note || null, billable: form.billable,
    });
    form.dur = ''; form.note = '';
    await reload();
  } catch { toast.error('Couldn’t log time'); }
}
async function toggleBillable(e) {
  e.billable = !e.billable;
  try { await timeEntries.update(e.id, { billable: e.billable }); }
  catch { e.billable = !e.billable; toast.error('Update failed'); }
}
async function destroy(e) {
  const i = entries.value.indexOf(e);
  if (i > -1) entries.value.splice(i, 1);
  try {
    await timeEntries.remove(e.id);
    toast.show('Entry deleted', {
      kind: 'info', ttl: 5000,
      action: { label: 'Undo', run: async () => { await timeEntries.restore(e.id); reload(); } },
    });
  } catch { toast.error('Delete failed'); reload(); }
}

onMounted(load);
watch(() => timer.running?.id, () => reload());
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Time</h1>
      <span class="text-sm text-slate-warm">
        This week: <span class="text-ink font-medium tabular-nums">{{ fmtHours(weekMinutes) }}</span>
        <template v-if="weekBillable !== weekMinutes"> · {{ fmtHours(weekBillable) }} billable</template>
      </span>
    </header>

    <!-- Timer / entry card -->
    <div class="card space-y-3">
      <!-- Running -->
      <div v-if="timer.running" class="flex items-center gap-4">
        <span class="h-2.5 w-2.5 rounded-full bg-terracotta animate-pulse shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="text-2xl font-serif text-ink tabular-nums leading-none">{{ runLabel }}</div>
          <div class="text-sm text-slate-warm truncate mt-0.5">
            {{ timer.running.project_name || timer.running.client_name || 'Working…' }}
            <template v-if="timer.running.note"> · {{ timer.running.note }}</template>
          </div>
        </div>
        <button @click="stop" class="btn-primary text-sm">Stop</button>
      </div>

      <!-- Start / log -->
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="form.project_id" class="text-sm bg-transparent border border-sand rounded-md px-2 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40">
            <option value="">No project</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-model="form.client_id" class="text-sm bg-transparent border border-sand rounded-md px-2 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40">
            <option value="">No client</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <input
            v-model="form.note"
            placeholder="What are you working on?"
            class="flex-1 min-w-[10rem] bg-transparent border border-sand rounded-md px-2.5 py-1.5 placeholder-slate-warm/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            @keydown.enter.prevent="start"
          />
          <button @click="start" class="btn-primary text-sm inline-flex items-center gap-1.5">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Start
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm text-slate-warm border-t border-sand/60 pt-3">
          <span>or log</span>
          <input v-model="form.dur" placeholder="1h30m" class="w-20 bg-transparent border border-sand rounded-md px-2 py-1 text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40" @keydown.enter.prevent="logManual" />
          <span>on</span>
          <input v-model="form.date" type="date" class="bg-transparent border border-sand rounded-md px-2 py-1 text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40" />
          <button @click="logManual" class="btn-ghost text-sm">Add</button>
          <label class="flex items-center gap-1.5 ml-auto cursor-pointer">
            <input type="checkbox" v-model="form.billable" class="accent-terracotta" />
            Billable
          </label>
        </div>
      </template>
    </div>

    <Skeleton v-if="loading" :rows="4" />
    <EmptyState
      v-else-if="!completed.length"
      icon="◔"
      title="No time logged yet"
      hint="Start a timer or log past hours against a client or project."
    />

    <div v-else class="space-y-5">
      <section v-for="day in byDay" :key="day.label">
        <div class="flex items-baseline justify-between mb-1.5 px-1">
          <h2 class="text-sm font-medium text-ink">{{ day.label }}</h2>
          <span class="text-xs text-slate-warm tabular-nums">{{ fmtDuration(day.total) }}</span>
        </div>
        <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
          <li
            v-for="(e, idx) in day.items"
            :key="e.id"
            :class="['group flex items-center gap-3 px-4 py-2.5', idx > 0 && 'border-t border-sand/60']"
          >
            <span class="text-sm font-medium text-ink tabular-nums w-16 shrink-0">{{ fmtDuration(e.minutes) }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-ink truncate">{{ e.note || e.project_name || e.client_name || 'Untitled' }}</div>
              <div class="flex items-center gap-2 text-xs text-slate-warm">
                <span v-if="e.project_name" class="truncate">{{ e.project_name }}</span>
                <ClientChip v-if="e.client_name" :name="e.client_name" :id="e.client_id" size="sm" :hover="false" />
              </div>
            </div>
            <button
              @click="toggleBillable(e)"
              :class="['text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0', e.billable ? 'bg-terracotta/15 text-terracotta' : 'bg-sand text-slate-warm']"
              :title="e.billable ? 'Billable — click to mark non-billable' : 'Non-billable'"
            >{{ e.billable ? 'Billable' : 'Unbilled' }}</button>
            <button @click="destroy(e)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Delete">✕</button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
