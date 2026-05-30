<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { todos as api } from '../api/endpoints.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useToastStore } from '../stores/toast.js';
import Skeleton from '../components/Skeleton.vue';
import MicButton from '../components/MicButton.vue';
import { format, isToday, isYesterday } from 'date-fns';

const ws = useWorkspaceStore();
const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const filter = ref('all'); // 'all' | workspace id | 'none'
const drafts = reactive({}); // card key -> input text

async function load() {
  loading.value = true;
  try { items.value = await api.list(); }
  finally { loading.value = false; }
}
onMounted(load);

// ---- helpers ----
function dayKey(d) { return format(new Date(d), 'yyyy-MM-dd'); }
function dayLabel(d) {
  const dt = new Date(d);
  if (isToday(dt)) return 'Today';
  if (isYesterday(dt)) return 'Yesterday';
  return format(dt, 'EEEE, MMM d');
}
function isTodayTodo(t) { return isToday(new Date(t.created_at)); }
function sortTodos(arr) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}
function wsColor(w) { return w?.color ? `#${w.color}` : '#9CA3AF'; }
function wsIcon(w) { return w?.icon || w?.name?.[0] || '·'; }

const filtered = computed(() => {
  if (filter.value === 'all') return items.value;
  if (filter.value === 'none') return items.value.filter((t) => t.workspace_id == null);
  return items.value.filter((t) => t.workspace_id === Number(filter.value));
});

// Today's todos bucketed by workspace id (or 'none')
const todayByWs = computed(() => {
  const m = new Map();
  for (const t of filtered.value) {
    if (!isTodayTodo(t)) continue;
    const k = t.workspace_id ?? 'none';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return m;
});

// Which workspace cards to show under Today (always show every workspace so
// there's an add box for each — that's the "show all workspaces for today" ask).
const todayCards = computed(() => {
  let cards;
  if (filter.value === 'all') cards = ws.list.map((w) => ({ wsId: w.id, ws: w }));
  else if (filter.value === 'none') cards = [];
  else cards = ws.list.filter((w) => w.id === Number(filter.value)).map((w) => ({ wsId: w.id, ws: w }));

  const hasUnassignedToday = (todayByWs.value.get('none') || []).length > 0;
  if (filter.value === 'none' || (filter.value === 'all' && hasUnassignedToday)) {
    cards.push({ wsId: 'none', ws: null });
  }
  return cards;
});

function todayTodos(wsId) { return sortTodos(todayByWs.value.get(wsId) || []); }
function openCount(list) { return list.filter((t) => !t.done).length; }

// Past days → workspace groups (no add boxes, just history)
const pastDays = computed(() => {
  const map = new Map();
  for (const t of filtered.value) {
    if (isTodayTodo(t)) continue;
    const k = dayKey(t.created_at);
    if (!map.has(k)) map.set(k, { key: k, label: dayLabel(t.created_at), groups: new Map() });
    const day = map.get(k);
    const wsId = t.workspace_id ?? 'none';
    if (!day.groups.has(wsId)) day.groups.set(wsId, []);
    day.groups.get(wsId).push(t);
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((d) => ({
      key: d.key,
      label: d.label,
      groups: [...d.groups.entries()].map(([wsId, todos]) => ({
        wsId,
        ws: wsId === 'none' ? null : ws.list.find((w) => w.id === wsId),
        todos: sortTodos(todos),
      })),
    }));
});

const totalOpen = computed(() => items.value.filter((t) => !t.done).length);
const totalDone = computed(() => items.value.filter((t) => t.done).length);

// ---- mutations ----
async function addTo(wsId) {
  const key = String(wsId);
  const raw = (drafts[key] || '').trim();
  if (!raw) return;
  const labels = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  drafts[key] = '';
  const realWsId = wsId === 'none' ? null : wsId;
  const wsObj = realWsId ? ws.list.find((w) => w.id === realWsId) : null;

  for (const label of labels) {
    const tmpId = `tmp-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const optimistic = {
      id: tmpId, label, done: false, workspace_id: realWsId,
      workspace_name: wsObj?.name, workspace_color: wsObj?.color, workspace_icon: wsObj?.icon,
      created_at: new Date().toISOString(), _pending: true,
    };
    items.value = [...items.value, optimistic];
    try {
      const real = await api.create({ label, workspace_id: realWsId });
      real.workspace_name = wsObj?.name;
      real.workspace_color = wsObj?.color;
      real.workspace_icon = wsObj?.icon;
      items.value = items.value.map((t) => (t.id === tmpId ? real : t));
    } catch {
      items.value = items.value.filter((t) => t.id !== tmpId);
      toast.error('Failed to add todo');
    }
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

async function updateWorkspace(t, wsIdRaw) {
  const realWsId = wsIdRaw === '' || wsIdRaw == null ? null : Number(wsIdRaw);
  const wsObj = realWsId ? ws.list.find((w) => w.id === realWsId) : null;
  const snapshot = items.value;
  items.value = items.value.map((x) =>
    x.id === t.id ? { ...x, workspace_id: realWsId, workspace_name: wsObj?.name, workspace_color: wsObj?.color, workspace_icon: wsObj?.icon } : x,
  );
  try {
    await api.update(t.id, { workspace_id: realWsId });
  } catch {
    items.value = snapshot;
    toast.error('Failed to move');
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
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <header class="flex items-baseline justify-between gap-3">
      <h1 class="text-2xl sm:text-3xl font-serif text-ink">Todos</h1>
      <span class="text-sm text-slate-warm tabular-nums">{{ totalOpen }} open · {{ totalDone }} done</span>
    </header>

    <div class="flex items-center gap-1 text-sm flex-wrap">
      <button @click="filter = 'all'" :class="['px-2.5 py-1 rounded', filter === 'all' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">All</button>
      <button
        v-for="w in ws.list"
        :key="w.id"
        @click="filter = w.id"
        :class="['px-2.5 py-1 rounded flex items-center gap-1.5', filter === w.id ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: wsColor(w) }" />
        {{ w.name }}
      </button>
      <button @click="filter = 'none'" :class="['px-2.5 py-1 rounded', filter === 'none' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Unassigned</button>
    </div>

    <Skeleton v-if="loading" :rows="5" />

    <template v-else>
      <!-- TODAY -->
      <section class="space-y-3">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm font-semibold">Today</h2>
        <div
          v-for="card in todayCards"
          :key="String(card.wsId)"
          class="card !p-4"
        >
          <div class="flex items-center gap-2 mb-2">
            <span
              class="h-5 w-5 grid place-items-center rounded text-warm text-[10px] font-serif shrink-0"
              :style="{ background: card.ws ? wsColor(card.ws) : '#9CA3AF' }"
            >{{ card.ws ? wsIcon(card.ws) : '·' }}</span>
            <span class="font-medium text-ink">{{ card.ws ? card.ws.name : 'Unassigned' }}</span>
            <span class="text-xs text-slate-warm tabular-nums ml-auto">{{ openCount(todayTodos(card.wsId)) }}</span>
          </div>

          <ul class="space-y-0.5">
            <li
              v-for="t in todayTodos(card.wsId)"
              :key="t.id"
              :class="['flex items-center gap-3 py-1.5 group rounded px-2 -mx-2 hover:bg-sand/30 transition-colors', t._pending && 'opacity-60']"
            >
              <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40 shrink-0" />
              <input
                :value="t.label"
                @change="updateLabel(t, $event.target.value)"
                :class="['flex-1 bg-transparent focus:outline-none text-sm', t.done && 'line-through text-slate-warm']"
              />
              <select
                :value="t.workspace_id ?? ''"
                @change="updateWorkspace(t, $event.target.value)"
                class="text-xs bg-transparent text-slate-warm focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                title="Move to workspace"
              >
                <option value="">Unassigned</option>
                <option v-for="w in ws.list" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
              <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity shrink-0">×</button>
            </li>
          </ul>

          <form @submit.prevent="addTo(card.wsId)" class="flex items-center gap-2 pt-1 mt-1">
            <span class="w-4 text-center text-slate-warm shrink-0">+</span>
            <input
              v-model="drafts[String(card.wsId)]"
              @keydown.enter.prevent="addTo(card.wsId)"
              :placeholder="`Add to ${card.ws ? card.ws.name : 'Unassigned'}… (enter to add, keep going)`"
              class="flex-1 bg-transparent focus:outline-none text-sm placeholder-slate-warm/50"
            />
            <MicButton v-model="drafts[String(card.wsId)]" mode="append" />
          </form>
        </div>
      </section>

      <!-- PAST DAYS -->
      <section v-for="day in pastDays" :key="day.key" class="space-y-2">
        <h2 class="text-xs uppercase tracking-wider text-slate-warm font-semibold">{{ day.label }}</h2>
        <div v-for="grp in day.groups" :key="String(grp.wsId)" class="pl-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ background: grp.ws ? wsColor(grp.ws) : '#9CA3AF' }" />
            <span class="text-sm text-slate-warm">{{ grp.ws ? grp.ws.name : 'Unassigned' }}</span>
          </div>
          <ul class="space-y-0.5 pl-1">
            <li
              v-for="t in grp.todos"
              :key="t.id"
              class="flex items-center gap-3 py-1 group rounded px-2 -mx-2 hover:bg-sand/30 transition-colors"
            >
              <input type="checkbox" :checked="t.done" @change="toggle(t)" class="h-4 w-4 rounded border-sand text-terracotta focus:ring-terracotta/40 shrink-0" />
              <input
                :value="t.label"
                @change="updateLabel(t, $event.target.value)"
                :class="['flex-1 bg-transparent focus:outline-none text-sm', t.done && 'line-through text-slate-warm']"
              />
              <button @click="destroy(t)" class="text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity shrink-0">×</button>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
