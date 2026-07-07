<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { metrics as api } from '../api/endpoints.js';
import CountUp from '../components/CountUp.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();

const snapshots = ref([]);
const loading = ref(true);
const logging = ref(false);
const valueInput = ref(null);
const form = reactive({ metric: '', value_num: '', unit: 'count', period: '' });

const PRESETS = ['MRR', 'Active users', 'Signups', 'Churn'];

// Group snapshots into one series per metric (already period-ascending from the API).
const series = computed(() => {
  const map = new Map();
  for (const s of snapshots.value) {
    if (!map.has(s.metric)) map.set(s.metric, []);
    map.get(s.metric).push(s);
  }
  return [...map.entries()].map(([metric, rows]) => {
    const values = rows.map((r) => Number(r.value_num));
    const latest = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : null;
    return {
      metric,
      unit: rows[rows.length - 1].unit,
      values,
      latest,
      delta: prev == null ? null : latest - prev,
      updated: rows[rows.length - 1].period,
    };
  });
});

async function load() {
  loading.value = true;
  snapshots.value = await api.list();
  loading.value = false;
}

function today() {
  // Local calendar date (not UTC) so "log today" matches the user's actual day.
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function openLog(existing) {
  form.metric = existing?.metric || '';
  form.unit = existing?.unit || 'count';
  form.value_num = '';
  form.period = today();
  logging.value = true;
  nextTick(() => valueInput.value?.focus());
}

async function save() {
  const metric = form.metric.trim();
  if (!metric || form.value_num === '') return;
  try {
    await api.save({ metric, value_num: Number(form.value_num), unit: form.unit, period: form.period || today() });
    logging.value = false;
    await load();
  } catch { toast.error('Couldn’t save metric'); }
}

async function removeSeries(metric) {
  if (!confirm(`Delete the "${metric}" metric and all its history?`)) return;
  try { await api.removeSeries(metric); await load(); }
  catch { toast.error('Delete failed'); }
}

function fmtPrefix(unit) { return unit === 'currency' ? '$' : ''; }
function fmtSuffix(unit) { return unit === 'percent' ? '%' : ''; }
function fmtDelta(d, unit) {
  const sign = d > 0 ? '▲' : d < 0 ? '▼' : '·';
  return `${sign} ${fmtPrefix(unit)}${Math.abs(Math.round(d)).toLocaleString()}${fmtSuffix(unit)}`;
}

// A tiny inline sparkline over the raw value series.
function sparkPoints(values) {
  if (values.length < 2) return '';
  const w = 132, h = 34;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  return values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ');
}

function fmtPeriod(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="max-w-5xl space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Metrics</h1>
      <button @click="openLog()" class="btn-primary text-sm">Log a number</button>
    </header>

    <Skeleton v-if="loading" :rows="3" />
    <EmptyState
      v-else-if="!series.length"
      icon="∿"
      title="No metrics yet"
      hint="Log the few numbers that matter — MRR, signups, churn — and watch them move."
    />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal-group">
      <div v-for="s in series" :key="s.metric" class="card lift group relative">
        <button
          @click="removeSeries(s.metric)"
          class="absolute top-3 right-3 text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          title="Delete metric"
        >✕</button>
        <div class="text-xs text-slate-warm mb-1">{{ s.metric }}</div>
        <div class="text-3xl font-serif text-ink tabular-nums leading-none">
          {{ fmtPrefix(s.unit) }}<CountUp :value="s.latest" />{{ fmtSuffix(s.unit) }}
        </div>
        <div class="flex items-center gap-2 mt-1.5 text-xs">
          <span v-if="s.delta != null" :class="s.delta >= 0 ? 'text-terracotta' : 'text-slate-warm'">{{ fmtDelta(s.delta, s.unit) }}</span>
          <span class="text-slate-warm">as of {{ fmtPeriod(s.updated) }}</span>
        </div>
        <svg v-if="s.values.length > 1" viewBox="0 0 132 34" class="w-full h-9 mt-3 text-terracotta overflow-visible" preserveAspectRatio="none">
          <polyline :points="sparkPoints(s.values)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <button @click="openLog(s)" class="mt-3 text-xs text-slate-warm hover:text-terracotta">+ log today</button>
      </div>
    </div>

    <!-- Log modal -->
    <Teleport to="body">
      <div v-if="logging" class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" @mousedown.self="logging = false">
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="logging = false" />
        <div class="relative w-full max-w-sm bg-surface border border-sand rounded-xl shadow-2xl p-5 space-y-3">
          <h2 class="font-serif text-lg text-ink">Log a number</h2>
          <div>
            <label class="label">Metric</label>
            <input v-model="form.metric" list="metric-presets" placeholder="e.g. MRR" class="input" />
            <datalist id="metric-presets">
              <option v-for="p in PRESETS" :key="p" :value="p" />
            </datalist>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="label">Value</label>
              <input ref="valueInput" v-model="form.value_num" type="number" step="any" class="input" @keydown.enter.prevent="save" />
            </div>
            <div>
              <label class="label">Unit</label>
              <select v-model="form.unit" class="input">
                <option value="count">Count</option>
                <option value="currency">$</option>
                <option value="percent">%</option>
              </select>
            </div>
          </div>
          <div>
            <label class="label">Date</label>
            <input v-model="form.period" type="date" class="input" />
          </div>
          <div class="flex items-center justify-end gap-2 pt-1">
            <button @click="logging = false" class="btn-ghost text-sm">Cancel</button>
            <button @click="save" :disabled="!form.metric.trim() || form.value_num === ''" class="btn-primary text-sm">Save</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
