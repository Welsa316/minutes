<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, isSameMonth, isSameDay, format, isToday,
} from 'date-fns';
import { meetings as api } from '../api/endpoints.js';
import ClientChip from '../components/ClientChip.vue';
import TagChip from '../components/TagChip.vue';
import SavedViewsBar from '../components/SavedViewsBar.vue';
import EmptyState from '../components/EmptyState.vue';
import { clientColor } from '../utils/colors.js';
import { useListNav } from '../composables/useListNav.js';

const route = useRoute();
const router = useRouter();
const items = ref([]);
const loading = ref(true);
const filter = computed({
  get: () => route.query.filter || 'all',
  set: (v) => router.replace({ query: { ...route.query, filter: v === 'all' ? undefined : v } }),
});
const activeTag = computed(() => route.query.tag || null);
const view = ref(route.query.view === 'calendar' ? 'calendar' : 'list');
const cursor = ref(new Date());

const filtered = computed(() => {
  const now = Date.now();
  let rows = items.value;
  if (activeTag.value) rows = rows.filter((m) => (m.tags || []).includes(activeTag.value));
  if (filter.value === 'upcoming') return rows.filter((m) => m.date && new Date(m.date).getTime() >= now);
  if (filter.value === 'past') return rows.filter((m) => m.date && new Date(m.date).getTime() < now);
  return rows;
});

const gridDays = computed(() => {
  const start = startOfWeek(startOfMonth(cursor.value), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor.value), { weekStartsOn: 1 });
  const days = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
});

const byDay = computed(() => {
  const map = new Map();
  for (const m of items.value) {
    if (!m.date) continue;
    const key = format(new Date(m.date), 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  for (const arr of map.values()) arr.sort((a, b) => new Date(a.date) - new Date(b.date));
  return map;
});

function dayMeetings(date) {
  return byDay.value.get(format(date, 'yyyy-MM-dd')) || [];
}

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtTime(d) {
  return format(new Date(d), 'h:mm a');
}

const { selectedId } = useListNav({
  items: computed(() => view.value === 'list' ? filtered.value : []),
  pathFor: (m) => `/meetings/${m.id}`,
});

watch(view, (v) => {
  router.replace({ query: { ...route.query, view: v === 'calendar' ? 'calendar' : undefined } });
});

onMounted(load);
</script>

<template>
  <div :class="['space-y-5', view === 'calendar' ? 'max-w-none' : 'max-w-4xl']">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Meetings</h1>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 text-sm">
          <button @click="view = 'list'" :class="['px-2.5 py-1 rounded', view === 'list' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">List</button>
          <button @click="view = 'calendar'" :class="['px-2.5 py-1 rounded', view === 'calendar' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Calendar</button>
        </div>
        <RouterLink to="/meetings/new" class="btn-primary text-sm">+ New</RouterLink>
      </div>
    </header>

    <!-- List view -->
    <template v-if="view === 'list'">
      <div class="flex items-center gap-3 text-sm flex-wrap">
        <div class="flex items-center gap-1">
          <button @click="filter = 'all'" :class="['px-2.5 py-1 rounded', filter === 'all' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">All</button>
          <button @click="filter = 'upcoming'" :class="['px-2.5 py-1 rounded', filter === 'upcoming' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Upcoming</button>
          <button @click="filter = 'past'" :class="['px-2.5 py-1 rounded', filter === 'past' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Past</button>
        </div>
        <SavedViewsBar section="meetings" :filter-keys="['filter', 'tag']" />
      </div>

      <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
      <EmptyState
        v-else-if="!filtered.length"
        icon="◷"
        title="No meetings"
        hint="Track every conversation. Prep, capture, then close out with action items."
        shortcut="⌘N"
      />
      <ul v-else class="border border-sand rounded-lg overflow-hidden bg-surface">
        <RouterLink
          v-for="(m, idx) in filtered"
          :key="m.id"
          :to="`/meetings/${m.id}`"
          custom
          v-slot="{ navigate }"
        >
        <li
          @click="navigate"
          :class="['relative pl-4 pr-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60', selectedId === m.id && 'bg-sand/30 ring-1 ring-inset ring-terracotta/30']"
        >
          <span v-if="m.client_name" aria-hidden class="absolute left-0 top-0 bottom-0 w-1" :style="{ background: clientColor(m.client_name).bg }" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-ink truncate">{{ m.title }}</div>
            <div class="flex items-center gap-2 flex-wrap text-sm text-slate-warm">
              <ClientChip v-if="m.client_name" :name="m.client_name" :id="m.client_id" size="sm" />
              <template v-if="m.project_name">
                <span>·</span>
                <span class="truncate">{{ m.project_name }}</span>
              </template>
              <TagChip v-for="t in m.tags" :key="t" :tag="t" size="xs" />
            </div>
          </div>
          <span v-if="m.location" class="text-xs text-slate-warm capitalize">{{ m.location }}</span>
          <span class="text-xs text-slate-warm tabular-nums whitespace-nowrap">{{ fmtDate(m.date) }}</span>
        </li>
        </RouterLink>
      </ul>
    </template>

    <!-- Calendar view -->
    <template v-if="view === 'calendar'">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-xl text-ink">{{ format(cursor, 'MMMM yyyy') }}</h2>
        <div class="flex items-center gap-1">
          <button @click="cursor = addMonths(cursor, -1)" class="btn-ghost text-sm px-2">‹</button>
          <button @click="cursor = new Date()" class="btn-ghost text-sm">Today</button>
          <button @click="cursor = addMonths(cursor, 1)" class="btn-ghost text-sm px-2">›</button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-px bg-sand rounded-lg overflow-hidden border border-sand">
        <div v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d" class="bg-surface text-center py-2 text-[11px] uppercase tracking-wider text-slate-warm">{{ d }}</div>
        <div
          v-for="d in gridDays"
          :key="d.toISOString()"
          :class="[
            'bg-surface p-1.5 min-h-[5.5rem] flex flex-col gap-1',
            !isSameMonth(d, cursor) && 'opacity-40',
          ]"
        >
          <div :class="['text-xs', isToday(d) ? 'font-semibold text-terracotta' : 'text-slate-warm']">
            {{ format(d, 'd') }}
          </div>
          <button
            v-for="m in dayMeetings(d)"
            :key="m.id"
            type="button"
            @click="router.push(`/meetings/${m.id}`)"
            class="text-left text-[11px] rounded px-1.5 py-0.5 truncate hover:opacity-80"
            :style="{ background: clientColor(m.client_name || m.title).soft, color: clientColor(m.client_name || m.title).text }"
            :title="`${m.title} — ${fmtTime(m.date)}`"
          >{{ fmtTime(m.date) }} {{ m.title }}</button>
        </div>
      </div>
    </template>
  </div>
</template>
