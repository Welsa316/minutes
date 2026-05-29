<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { meetings, projects, notes, clients } from '../api/endpoints.js';
import { useAuthStore } from '../stores/auth.js';
import Skeleton from '../components/Skeleton.vue';
import CountUp from '../components/CountUp.vue';
import Heatmap from '../components/Heatmap.vue';
import ClientChip from '../components/ClientChip.vue';

const auth = useAuthStore();
const upcoming = ref([]);
const active = ref([]);
const recent = ref([]);
const allMeetings = ref([]);
const totals = ref({ clients: 0, projects: 0, meetings: 0, notes: 0 });
const loading = ref(true);

const greeting = computed(() => {
  const h = new Date().getHours();
  const name = auth.user?.username || '';
  if (h < 5)  return `Late night, ${name}`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  if (h < 21) return `Good evening, ${name}`;
  return `Late night, ${name}`;
});

// "On this day" — meetings from exactly 1, 2, 3 years ago.
const onThisDay = computed(() => {
  const today = new Date();
  const out = [];
  for (let y = 1; y <= 3; y++) {
    const target = allMeetings.value.filter((m) => {
      if (!m.date) return false;
      const d = new Date(m.date);
      return (
        d.getFullYear() === today.getFullYear() - y &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
    for (const m of target) out.push({ ...m, yearsAgo: y });
  }
  return out;
});

async function load() {
  const [m, p, n, c, allM] = await Promise.all([
    meetings.list({ upcoming: true }),
    projects.list({ status: 'active' }),
    notes.list(),
    clients.list(),
    meetings.list(),
  ]);
  upcoming.value = m.slice(0, 6);
  active.value = p.slice(0, 6);
  recent.value = n.slice(0, 6);
  allMeetings.value = allM;
  totals.value = {
    clients: c.length,
    projects: p.length,
    meetings: allM.length,
    notes: n.length,
  };
  loading.value = false;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function relativeDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <header class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
      <h1 class="text-2xl sm:text-3xl font-serif text-ink">{{ greeting }}</h1>
      <div class="flex items-center gap-3 sm:gap-4 text-xs text-slate-warm tabular-nums flex-wrap">
        <span><CountUp :value="totals.clients" /> clients</span>
        <span><CountUp :value="totals.projects" /> projects</span>
        <span><CountUp :value="totals.meetings" /> meetings</span>
        <span><CountUp :value="totals.notes" /> notes</span>
      </div>
    </header>

    <Skeleton v-if="loading" variant="dashboard" />
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section class="card">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Upcoming meetings</h2>
            <RouterLink to="/meetings?filter=upcoming" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="upcoming.length" class="space-y-2">
            <li v-for="m in upcoming" :key="m.id">
              <RouterLink :to="`/meetings/${m.id}`" class="block group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ m.title }}</div>
                <div class="text-xs text-slate-warm">{{ fmtDate(m.date) }}<template v-if="m.client_name"> · {{ m.client_name }}</template></div>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-warm">None.</p>
        </section>

        <section class="card">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Active projects</h2>
            <RouterLink to="/projects?status=active" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="active.length" class="space-y-2">
            <li v-for="p in active" :key="p.id">
              <RouterLink :to="`/projects/${p.id}`" class="block group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ p.name }}</div>
                <div class="text-xs text-slate-warm">
                  <template v-if="p.client_name">{{ p.client_name }}</template>
                  <template v-if="p.client_name && p.deadline"> · </template>
                  <template v-if="p.deadline">due {{ relativeDate(p.deadline) }}</template>
                </div>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-warm">None.</p>
        </section>

        <section class="card">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Recent notes</h2>
            <RouterLink to="/notes" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="recent.length" class="space-y-2">
            <li v-for="n in recent" :key="n.id">
              <RouterLink :to="`/notes/${n.id}`" class="block group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ n.title }}</div>
                <div class="text-xs text-slate-warm">{{ relativeDate(n.created_at) }}</div>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-warm">None.</p>
        </section>
      </div>

      <section class="card">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="font-serif text-lg text-ink">Activity</h2>
          <span class="text-xs text-slate-warm">last 6 months</span>
        </div>
        <Heatmap :events="allMeetings.filter(m => m.date).map(m => ({ date: m.date }))" />
      </section>

      <section v-if="onThisDay.length" class="card">
        <h2 class="font-serif text-lg text-ink mb-3">On this day</h2>
        <ul class="space-y-2">
          <li v-for="m in onThisDay" :key="`${m.yearsAgo}-${m.id}`">
            <RouterLink :to="`/meetings/${m.id}`" class="block group flex items-center gap-3">
              <span class="text-xs text-slate-warm tabular-nums w-20">{{ m.yearsAgo }} year{{ m.yearsAgo === 1 ? '' : 's' }} ago</span>
              <span class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ m.title }}</span>
              <ClientChip v-if="m.client_name" :name="m.client_name" :id="m.client_id" size="sm" :hover="false" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
