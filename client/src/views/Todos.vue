<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { todos as api } from '../api/endpoints.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useToastStore } from '../stores/toast.js';
import { parseSmart, humanizeDay } from '../utils/dates.js';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { startOfToday, endOfWeek, isToday } from 'date-fns';

const ws = useWorkspaceStore();
const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const newLabel = ref('');
const newDate = ref('');
const newWorkspaceId = ref(null);
const filterWorkspaceId = ref('all'); // 'all' | 'none' | workspace id
const adding = ref(false);

// Default the new-todo workspace to whichever is active.
watch(() => ws.activeId, (id) => {
  if (newWorkspaceId.value == null) newWorkspaceId.value = id;
}, { immediate: true });

async function load() {
  loading.value = true;
  try { items.value = await api.list(); }
  finally { loading.value = false; }
}

onMounted(load);

const parsedNewDate = computed(() => parseSmart(newDate.value));

const filtered = computed(() => {
  if (filterWorkspaceId.value === 'all') return items.value;
  if (filterWorkspaceId.value === 'none') return items.value.filter((t) => t.workspace_id == null);
  const id = Number(filterWorkspaceId.value);
  return items.value.filter((t) => t.workspace_id === id);
});

async function create() {
  const label = newLabel.value.trim();
  if (!label) return;
  adding.value = true;
  const wId = newWorkspaceId.value || null;
  const wsObj = wId ? ws.list.find((w) => w.id === wId) : null;
  const optimistic = {
    id: `tmp-${Date.now()}`,
    label,
    due_date: parsedNewDate.value ? parsedNewDate.value.toISOString().slice(0, 10) : null,
    done: false,
    priority: null,
    workspace_id: wId,
    workspace_name: wsObj?.name,
    workspace_color: wsObj?.color,
    workspace_icon: wsObj?.icon,
    created_at: new Date().toISOString(),
    _pending: true,
  };
  items.value = [...items.value, optimistic];
  newLabel.value = '';
  newDate.value = '';
  try {
    const real = await api.create({ label, due_date: optimistic.due_date, workspace_id: wId });
    // Re-enrich with the workspace metadata since the API just returns the bare row.
    real.workspace_name = wsObj?.name;
    real.workspace_color = wsObj?.color;
    real.workspace_icon = wsObj?.icon;
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
    items.value = items.value.map((x) => (x.id === t.id ? { ...x, ...real } : x));
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
    items.value = items.value.map((x) => (x.id === t.id ? { ...x, ...real } : x));
  } catch {
    items.value = snapshot;
    toast.error('Failed to update');
  }
}

async function updateDue(t, value) {
  const due = value || null;
  const snapshot = items.value;
  items.value = items.value.map((x) => (x.id === t.id ? { ...x, due_date: due } : x));
  try {
    const real = await api.update(t.id, { due_date: due });
    items.value = items.value.map((x) => (x.id === t.id ? { ...x, ...real } : x));
  } catch {
    items.value = snapshot;
    toast.error('Failed to update date');
  }
}

async function updateWorkspace(t, wId) {
  const id = wId === '' || wId === 'none' ? null : Number(wId);
  const wsObj = id ? ws.list.find((w) => w.id === id) : null;
  const snapshot = items.value;
  items.value = items.value.map((x) => (x.id === t.id ? { ...x, workspace_id: id, workspace_name: wsObj?.name, workspace_color: wsObj?.color, workspace_icon: wsObj?.icon } : x));
  try {
    await api.update(t.id, { workspace_id: id });
  } catch {
    items.value = snapshot;
    toast.error('Failed to update workspace');
  }
}

function dueAsDate(due) {
  if (!due) return null;
  const s = String(due).slice(0, 10);
  return new Date(s + 'T00:00:00');
}

const buckets = computed(() => {
  const tToday = startOfToday();
  const wkEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const overdue = [], today = [], thisWeek = [], later = [], someday = [], done = [];
  for (const t of filtered.value) {
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

function wsColor(t) {
  return t.workspace_color ? `#${t.workspace_color}` : '#9CA3AF';
}
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
      <select v-model="newWorkspaceId" class="bg-transparent text-sm text-slate-warm focus:outline-none">
        <option :value="null">No workspace</option>
        <option v-for="w in ws.list" :key="w.id" :value="w.id">{{ w.name }}</option>
      </select>
      <button type="submit" :disabled="!newLabel.trim() || adding" class="btn-primary text-sm">Add</button>
    </form>

    <div class="flex items-center gap-1 text-sm flex-wrap">
      <button @click="filterWorkspaceId = 'all'" :class="['px-2.5 py-1 rounded', filterWorkspaceId === 'all' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">All</button>
      <button
        v-for="w in ws.list"
        :key="w.id"
        @click="filterWorkspaceId = w.id"
        :class="['px-2.5 py-1 rounded flex items-center gap-1.5', filterWorkspaceId === w.id ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: `#${w.color || '0F1B2D'}` }" />
        {{ w.name }}
      </button>
      <button @click="filterWorkspaceId = 'none'" :class="['px-2.5 py-1 rounded', filterWorkspaceId === 'none' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Unassigned</button>
    </div>

    <Skeleton v-if="loading" :rows="6" />
    <EmptyState
      v-else-if="!filtered.length"
      icon="☑"
      title="Nothing on the list"
      hint="Quick captures, follow-ups, reminders. Press c to focus, type, hit enter."
      shortcut="c"
    />

    <template v-else>
      <section v-for="(group, key) in buckets" :key="key" v-show="group.length">
        <h2 :class="['text-xs uppercase tracking-wider mb-2 font-semibold', key === 'overdue' ? 'text-terracotta' : 'text-slate-warm']">
          {{ key === 'thisWeek' ? 'This week' : key.charAt(0).toUpperCase() + key.slice(1) }}
        </h2>
        <ul :class="['space-y-0.5', key === 'done' && 'opacity-60']">
          <li
            v-for="t in group"
            :key="t.id"
            class="flex items-center gap-3 py-1.5 group rounded hover:bg-sand/30 px-2 -mx-2 transition-colors"
          >
            <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40" />
            <span
              v-if="t.workspace_id"
              :title="t.workspace_name"
              class="h-2 w-2 rounded-full shrink-0"
              :style="{ background: wsColor(t) }"
            />
            <span v-else class="h-2 w-2 rounded-full bg-slate-warm/30 shrink-0" title="Unassigned" />
            <input
              :value="t.label"
              @change="updateLabel(t, $event.target.value)"
              :class="['flex-1 bg-transparent focus:outline-none text-sm', t.done && 'line-through text-slate-warm']"
            />
            <select
              :value="t.workspace_id ?? ''"
              @change="updateWorkspace(t, $event.target.value)"
              class="text-xs bg-transparent text-slate-warm focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
              title="Workspace"
            >
              <option value="">—</option>
              <option v-for="w in ws.list" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
            <span v-if="key === 'overdue'" class="text-xs text-terracotta tabular-nums">{{ humanizeDay(t.due_date) }}</span>
            <span v-else-if="t.due_date && key !== 'today' && key !== 'someday' && key !== 'done'" class="text-xs text-slate-warm tabular-nums">{{ humanizeDay(t.due_date) }}</span>
            <input
              v-if="key === 'someday' || key === 'today'"
              type="date"
              :value="ymd(t.due_date)"
              @change="updateDue(t, $event.target.value)"
              class="text-xs px-1 py-0.5 border border-transparent hover:border-sand rounded bg-transparent focus:outline-none text-slate-warm"
            />
            <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity">×</button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
