<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { dashboard } from '../api/endpoints.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import Skeleton from '../components/Skeleton.vue';
import CountUp from '../components/CountUp.vue';
import Heatmap from '../components/Heatmap.vue';
import ClientChip from '../components/ClientChip.vue';

const auth = useAuthStore();
const ws = useWorkspaceStore();
const router = useRouter();

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

// More than one workspace in play? Then the little workspace tags are useful.
const multiWorkspace = computed(() => ws.list.length > 1);

// "On this day" — meetings from exactly 1, 2, 3 years ago (across all workspaces).
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
  const d = await dashboard.get();
  upcoming.value = d.upcoming;
  active.value = d.activeProjects;
  recent.value = d.recentNotes;
  allMeetings.value = d.allMeetings;
  totals.value = d.totals;
  loading.value = false;
}

// The dashboard is global, so an item may live in a different workspace than the
// active one. Flip into its workspace before opening so the detail page loads.
function open(kind, item) {
  if (item.workspace_id && item.workspace_id !== ws.activeId) ws.setActive(item.workspace_id);
  router.push(`/${kind}/${item.id}`);
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
            <RouterLink to="/meetings" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="upcoming.length" class="space-y-2">
            <li v-for="m in upcoming" :key="m.id">
              <button @click="open('meetings', m)" class="block w-full text-left group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ m.title }}</div>
                <div class="text-xs text-slate-warm flex items-center gap-1.5">
                  <span
                    v-if="multiWorkspace"
                    class="inline-block h-2 w-2 rounded-full shrink-0"
                    :style="{ background: m.workspace_color ? '#' + m.workspace_color : 'rgb(var(--c-slate-warm))' }"
                    :title="m.workspace_name"
                  />
                  <span class="truncate">{{ fmtDate(m.date) }}<template v-if="m.client_name"> · {{ m.client_name }}</template></span>
                </div>
              </button>
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
              <button @click="open('projects', p)" class="block w-full text-left group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ p.name }}</div>
                <div class="text-xs text-slate-warm flex items-center gap-1.5">
                  <span
                    v-if="multiWorkspace"
                    class="inline-block h-2 w-2 rounded-full shrink-0"
                    :style="{ background: p.workspace_color ? '#' + p.workspace_color : 'rgb(var(--c-slate-warm))' }"
                    :title="p.workspace_name"
                  />
                  <span class="truncate">
                    <template v-if="p.client_name">{{ p.client_name }}</template>
                    <template v-if="p.client_name && p.deadline"> · </template>
                    <template v-if="p.deadline">due {{ relativeDate(p.deadline) }}</template>
                    <template v-if="!p.client_name && !p.deadline">—</template>
                  </span>
                </div>
              </button>
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
              <button @click="open('notes', n)" class="block w-full text-left group">
                <div class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ n.title }}</div>
                <div class="text-xs text-slate-warm flex items-center gap-1.5">
                  <span
                    v-if="multiWorkspace"
                    class="inline-block h-2 w-2 rounded-full shrink-0"
                    :style="{ background: n.workspace_color ? '#' + n.workspace_color : 'rgb(var(--c-slate-warm))' }"
                    :title="n.workspace_name"
                  />
                  <span class="truncate">{{ relativeDate(n.created_at) }}</span>
                </div>
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-warm">None.</p>
        </section>
      </div>

      <section class="card">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="font-serif text-lg text-ink">Activity</h2>
          <span class="text-xs text-slate-warm">last 6 months · all workspaces</span>
        </div>
        <Heatmap :events="allMeetings.filter(m => m.date).map(m => ({ date: m.date }))" />
      </section>

      <section v-if="onThisDay.length" class="card">
        <h2 class="font-serif text-lg text-ink mb-3">On this day</h2>
        <ul class="space-y-2">
          <li v-for="m in onThisDay" :key="`${m.yearsAgo}-${m.id}`">
            <button @click="open('meetings', m)" class="block w-full text-left group flex items-center gap-3">
              <span class="text-xs text-slate-warm tabular-nums w-20 shrink-0">{{ m.yearsAgo }} year{{ m.yearsAgo === 1 ? '' : 's' }} ago</span>
              <span class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ m.title }}</span>
              <ClientChip v-if="m.client_name" :name="m.client_name" :id="m.client_id" size="sm" :hover="false" />
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
