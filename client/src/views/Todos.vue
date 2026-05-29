<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { todos as api } from '../api/endpoints.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useToastStore } from '../stores/toast.js';
import { parseSmart, humanizeDay } from '../utils/dates.js';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import {
  startOfToday, endOfToday, startOfWeek, endOfWeek, isPast, isToday,
} from 'date-fns';

const ws = useWorkspaceStore();
const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const newLabel = ref('');
const newDate = ref('');
const adding = ref(false);

async function load() {
  loading.value = true;
  try { items.value = await api.list(); }
  finally { loading.value = false; }
}

watch(() => ws.activeId, load);
onMounted(load);

const parsedNewDate = computed(() => parseSmart(newDate.value));

async function create() {
  const label = newLabel.value.trim();
  if (!label) return;
  adding.value = true;
  const optimistic = {
    id: `tmp-${Date.now()}`,
    label,
    due_date: parsedNewDate.value ? parsedNewDate.value.toISOString().slice(0, 10) : null,
    done: false,
    priority: null,
    created_at: new Date().toISOString(),
    _pending: true,
  };
  items.value = [...items.value, optimistic];
  newLabel.value = '';
  newDate.value = '';
  try {
    const real = await api.create({ label, due_date: optimistic.due_date });
    items.value = items.value.map((t) => (t.id === optimistic.id ? real : t));
  } catch {
    items.value = items.value.filter((t) => t.id !== optimistic.id);
    toast.error('Failed to add todo');
  } finally {
    adding.value = false;
  }
}

async function toggle(t) {
  const snapshot = items.value;
  items.value = items.value.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x));
  try {
    const real = await api.toggle(t.id);
    items.value = items.value.map((x) => (x.id === t.id ? real : x));
  } catch {
    items.value = snapshot;
    toast.error('Failed to update');
  }
}

async function destroy(t) {
  const snapshot = items.value;
  items.value = items.value.filter((x) => x.id !== t.id);
  try {
    await api.remove(t.id);
    toast.show('Deleted todo', {
      ttl: 5000,
      action: { label: 'Undo', run: async () => { await api.restore(t.id); toast.success('Restored'); load(); } },
    });
  } catch {
    items.value = snapshot;
    toast.error('Failed to delete');
  }
}

async function updateLabel(t, value) {
  const v = value.trim();
  if (!v || v === t.label) return;
  const snapshot = items.value;
  items.value = items.value.map((x) => (x.id === t.id ? { ...x, label: v } : x));
  try {
    const real = await api.update(t.id, { label: v });
    items.value = items.value.map((x) => (x.id === t.id ? real : x));
  } catch {
    items.value = snapshot;
    toast.error('Failed to update');
  }
}

async function updateDue(t, value) {
  const due = value ? value : null;
  const snapshot = items.value;
  items.value = items.value.map((x) => (x.id === t.id ? { ...x, due_date: due } : x));
  try {
    const real = await api.update(t.id, { due_date: due });
    items.value = items.value.map((x) => (x.id === t.id ? real : x));
  } catch {
    items.value = snapshot;
    toast.error('Failed to update date');
  }
}

function dueAsDate(due) {
  if (!due) return null;
  // Server may return either "YYYY-MM-DD" or an ISO datetime. Strip to date.
  const s = String(due).slice(0, 10);
  return new Date(s + 'T00:00:00');
}

const buckets = computed(() => {
  const tToday = startOfToday();
  const wkEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const overdue = [], today = [], thisWeek = [], later = [], someday = [], done = [];
  for (const t of items.value) {
    if (t.done) { done.push(t); continue; }
    const d = dueAsDate(t.due_date);
    if (!d) { someday.push(t); continue; }
    if (d < tToday)      overdue.push(t);
    else if (isToday(d)) today.push(t);
    else if (d <= wkEnd) thisWeek.push(t);
    else                 later.push(t);
  }
  return { overdue, today, thisWeek, later, someday, done };
});

function ymd(d) { return d ? String(d).slice(0, 10) : ''; }
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <header class="flex items-baseline justify-between gap-3">
      <h1 class="text-3xl font-serif text-ink">Todos</h1>
      <span class="text-sm text-slate-warm tabular-nums">
        {{ items.filter(t => !t.done).length }} open · {{ items.filter(t => t.done).length }} done
      </span>
    </header>

    <form @submit.prevent="create" class="card flex items-center gap-3 py-2.5 px-4">
      <input
        v-model="newLabel"
        placeholder="New todo…"
        class="flex-1 bg-transparent focus:outline-none placeholder-slate-warm/60"
      />
      <input
        v-model="newDate"
        placeholder="tomorrow, fri 2pm…"
        class="bg-transparent focus:outline-none text-sm text-slate-warm placeholder-slate-warm/50 w-40"
      />
      <span v-if="parsedNewDate" class="text-xs text-slate-warm">→ {{ humanizeDay(parsedNewDate) }}</span>
      <button type="submit" :disabled="!newLabel.trim() || adding" class="btn-primary text-sm">Add</button>
    </form>

    <Skeleton v-if="loading" :rows="6" />
    <EmptyState
      v-else-if="!items.length"
      icon="☑"
      title="Nothing on the list"
      hint="Quick captures, follow-ups, reminders. Press c to focus, type, hit enter."
      shortcut="c"
    />

    <template v-else>
      <section v-if="buckets.overdue.length">
        <h2 class="text-xs uppercase tracking-wider text-terracotta font-semibold mb-2">Overdue</h2>
        <ul class="space-y-0.5">
          <li
            v-for="t in buckets.overdue"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <input :value="t.label" @change="updateLabel(t, $event.target.value)" class="flex-1 bg-transparent focus:outline-none text-sm" />
            <span class="text-xs text-terracotta tabular-nums">{{ humanizeDay(t.due_date) }}</span>
            <input type="date" :value="ymd(t.due_date)" @change="updateDue(t, $event.target.value)" class="text-xs px-1 py-0.5 border border-transparent hover:border-sand rounded bg-transparent focus:outline-none text-slate-warm" />
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>

      <section v-if="buckets.today.length">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm mb-2">Today</h2>
        <ul class="space-y-0.5">
          <li
            v-for="t in buckets.today"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <input :value="t.label" @change="updateLabel(t, $event.target.value)" class="flex-1 bg-transparent focus:outline-none text-sm" />
            <input type="date" :value="ymd(t.due_date)" @change="updateDue(t, $event.target.value)" class="text-xs px-1 py-0.5 border border-transparent hover:border-sand rounded bg-transparent focus:outline-none text-slate-warm" />
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>

      <section v-if="buckets.thisWeek.length">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm mb-2">This week</h2>
        <ul class="space-y-0.5">
          <li
            v-for="t in buckets.thisWeek"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <input :value="t.label" @change="updateLabel(t, $event.target.value)" class="flex-1 bg-transparent focus:outline-none text-sm" />
            <span class="text-xs text-slate-warm tabular-nums">{{ humanizeDay(t.due_date) }}</span>
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>

      <section v-if="buckets.later.length">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm mb-2">Later</h2>
        <ul class="space-y-0.5">
          <li
            v-for="t in buckets.later"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <input :value="t.label" @change="updateLabel(t, $event.target.value)" class="flex-1 bg-transparent focus:outline-none text-sm" />
            <span class="text-xs text-slate-warm tabular-nums">{{ humanizeDay(t.due_date) }}</span>
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>

      <section v-if="buckets.someday.length">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm mb-2">Someday</h2>
        <ul class="space-y-0.5">
          <li
            v-for="t in buckets.someday"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <input :value="t.label" @change="updateLabel(t, $event.target.value)" class="flex-1 bg-transparent focus:outline-none text-sm" />
            <input type="date" :value="ymd(t.due_date)" @change="updateDue(t, $event.target.value)" class="text-xs px-1 py-0.5 border border-transparent hover:border-sand rounded bg-transparent focus:outline-none text-slate-warm" title="Add due date" />
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>

      <section v-if="buckets.done.length">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm mb-2">Done</h2>
        <ul class="space-y-0.5 opacity-60">
          <li
            v-for="t in buckets.done"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <span class="flex-1 text-sm line-through text-slate-warm">{{ t.label }}</span>
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100">×</button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
