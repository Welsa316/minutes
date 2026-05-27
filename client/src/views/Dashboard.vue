<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { meetings, projects, notes } from '../api/endpoints.js';

const upcoming = ref([]);
const active = ref([]);
const recent = ref([]);
const loading = ref(true);

async function load() {
  const [m, p, n] = await Promise.all([
    meetings.list({ upcoming: true }),
    projects.list({ status: 'active' }),
    notes.list(),
  ]);
  upcoming.value = m.slice(0, 6);
  active.value = p.slice(0, 6);
  recent.value = n.slice(0, 6);
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
    <h1 class="text-3xl font-serif text-ink">Dashboard</h1>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <section class="card">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="font-serif text-lg text-ink">Upcoming meetings</h2>
          <RouterLink to="/meetings" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
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
          <RouterLink to="/projects" class="text-xs text-slate-warm hover:text-ink">All →</RouterLink>
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
  </div>
</template>
