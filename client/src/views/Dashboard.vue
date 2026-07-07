<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { dashboard } from '../api/endpoints.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { House } from 'lucide-vue-next';
import Skeleton from '../components/Skeleton.vue';
import CountUp from '../components/CountUp.vue';
import Heatmap from '../components/Heatmap.vue';
import ClientChip from '../components/ClientChip.vue';

const auth = useAuthStore();
const ws = useWorkspaceStore();
const router = useRouter();

// Corner shortcut back to the workspace portal.
function goHome() { router.push('/home'); }

const upcoming = ref([]);
const active = ref([]);
const recent = ref([]);
const allMeetings = ref([]);
const totals = ref({ clients: 0, projects: 0, meetings: 0, notes: 0 });
const loading = ref(true);

const greeting = computed(() => {
  const h = new Date().getHours();
  const name = (auth.user?.name || auth.user?.email?.split('@')[0] || '').split(' ')[0];
  if (h < 5)  return `Late night, ${name}`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  if (h < 21) return `Good evening, ${name}`;
  return `Late night, ${name}`;
});

// More than one workspace in play? Then the little workspace tags are useful.
const multiWorkspace = computed(() => ws.list.length > 1);

const dateLine = computed(() =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
);
const stats = computed(() => [
  { label: 'Clients', value: totals.value.clients },
  { label: 'Projects', value: totals.value.projects },
  { label: 'Meetings', value: totals.value.meetings },
  { label: 'Notes', value: totals.value.notes },
]);

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
  <div class="max-w-6xl">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 reveal">
      <div>
        <h1 class="text-3xl sm:text-4xl font-serif text-ink leading-tight">{{ greeting }}</h1>
        <p class="text-sm text-slate-warm mt-1">{{ dateLine }}</p>
      </div>
      <RouterLink to="/meetings/new" class="btn-primary text-sm inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        New meeting
      </RouterLink>
    </div>

    <Skeleton v-if="loading" variant="dashboard" />
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min reveal-group">
        <!-- Overview metrics (hero) -->
        <section class="card lift md:col-span-8">
          <div class="flex items-center justify-between mb-5">
            <h2 class="font-serif text-lg text-ink">Overview</h2>
            <span class="text-xs text-slate-warm">across {{ ws.list.length }} workspace{{ ws.list.length === 1 ? '' : 's' }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
            <div v-for="s in stats" :key="s.label" class="border-l-2 border-terracotta/25 pl-3">
              <div class="text-xs text-slate-warm mb-1.5">{{ s.label }}</div>
              <div class="text-3xl font-serif text-ink tabular-nums leading-none"><CountUp :value="s.value" /></div>
            </div>
          </div>
        </section>

        <section class="card lift md:col-span-4">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Upcoming meetings</h2>
            <RouterLink to="/meetings" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="upcoming.length" class="space-y-2 stagger">
            <li v-for="m in upcoming" :key="m.id">
              <button @click="open('meetings', m)" class="block w-full text-left group row-nudge">
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

        <section class="card lift md:col-span-6">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Active projects</h2>
            <RouterLink to="/projects?status=active" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="active.length" class="space-y-2 stagger">
            <li v-for="p in active" :key="p.id">
              <button @click="open('projects', p)" class="block w-full text-left group row-nudge">
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

        <section class="card lift md:col-span-6">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Recent notes</h2>
            <RouterLink to="/notes" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
          </div>
          <ul v-if="recent.length" class="space-y-2 stagger">
            <li v-for="n in recent" :key="n.id">
              <button @click="open('notes', n)" class="block w-full text-left group row-nudge">
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

        <section class="card md:col-span-12">
          <div class="flex items-baseline justify-between mb-3">
            <h2 class="font-serif text-lg text-ink">Activity</h2>
            <span class="text-xs text-slate-warm">last 6 months · all workspaces</span>
          </div>
          <Heatmap :events="allMeetings.filter(m => m.date).map(m => ({ date: m.date }))" />
        </section>

        <section v-if="onThisDay.length" class="card md:col-span-12">
          <h2 class="font-serif text-lg text-ink mb-3">On this day</h2>
          <ul class="space-y-2 stagger">
            <li v-for="m in onThisDay" :key="`${m.yearsAgo}-${m.id}`">
              <button @click="open('meetings', m)" class="block w-full text-left group row-nudge flex items-center gap-3">
                <span class="text-xs text-slate-warm tabular-nums w-20 shrink-0">{{ m.yearsAgo }} year{{ m.yearsAgo === 1 ? '' : 's' }} ago</span>
                <span class="text-sm font-medium text-ink truncate group-hover:text-terracotta">{{ m.title }}</span>
                <ClientChip v-if="m.client_name" :name="m.client_name" :id="m.client_id" size="sm" :hover="false" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- Corner shortcut back to the workspace portal -->
    <button
      @click="goHome"
      title="Back to workspaces"
      class="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full bg-surface border border-sand shadow-lg grid place-items-center text-slate-warm hover:text-terracotta hover:border-terracotta/40 transition-all hover:-translate-y-0.5"
    >
      <House class="h-5 w-5" :stroke-width="1.9" />
    </button>
  </div>
</template>
