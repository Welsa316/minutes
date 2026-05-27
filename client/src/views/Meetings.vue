<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { meetings as api } from '../api/endpoints.js';

const router = useRouter();
const items = ref([]);
const loading = ref(true);
const filter = ref('all'); // all | upcoming | past

const filtered = computed(() => {
  const now = Date.now();
  if (filter.value === 'upcoming') {
    return items.value.filter((m) => m.date && new Date(m.date).getTime() >= now);
  }
  if (filter.value === 'past') {
    return items.value.filter((m) => m.date && new Date(m.date).getTime() < now);
  }
  return items.value;
});

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function locIcon(loc) {
  if (loc === 'in-person') return '📍';
  if (loc === 'phone') return '☎';
  if (loc === 'video') return '▢';
  return '';
}

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl font-serif text-ink">Meetings</h1>
      <RouterLink to="/meetings/new" class="btn-primary text-sm">+ New meeting</RouterLink>
    </header>

    <div class="flex items-center gap-1 text-sm">
      <button @click="filter = 'all'" :class="['px-2.5 py-1 rounded', filter === 'all' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">All</button>
      <button @click="filter = 'upcoming'" :class="['px-2.5 py-1 rounded', filter === 'upcoming' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Upcoming</button>
      <button @click="filter = 'past'" :class="['px-2.5 py-1 rounded', filter === 'past' ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']">Past</button>
    </div>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else-if="!filtered.length" class="text-sm text-slate-warm">No meetings.</div>
    <ul v-else class="border border-sand rounded-lg overflow-hidden bg-warm">
      <li
        v-for="(m, idx) in filtered"
        :key="m.id"
        @click="router.push(`/meetings/${m.id}`)"
        :class="['px-4 py-3 hover:bg-sand/40 cursor-pointer flex items-center gap-4', idx > 0 && 'border-t border-sand/60']"
      >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">{{ m.title }}</div>
          <div class="text-sm text-slate-warm truncate">
            <template v-if="m.client_name">{{ m.client_name }}</template>
            <template v-if="m.client_name && m.project_name"> · </template>
            <template v-if="m.project_name">{{ m.project_name }}</template>
          </div>
        </div>
        <span v-if="m.location" class="text-xs text-slate-warm">{{ locIcon(m.location) }} {{ m.location }}</span>
        <span class="text-xs text-slate-warm tabular-nums">{{ fmtDate(m.date) }}</span>
      </li>
    </ul>
  </div>
</template>
