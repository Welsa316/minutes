<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { tags as api } from '../api/endpoints.js';
import TagChip from '../components/TagChip.vue';
import ClientChip from '../components/ClientChip.vue';
import StatusBadge from '../components/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const data = ref({ clients: [], projects: [], meetings: [], notes: [] });
const loading = ref(true);
const tagName = ref('');

async function load() {
  loading.value = true;
  tagName.value = decodeURIComponent(route.params.name);
  // Look up tag id by name
  const all = await api.list();
  const tag = all.find((t) => t.name === tagName.value);
  if (!tag) {
    data.value = { clients: [], projects: [], meetings: [], notes: [] };
  } else {
    data.value = await api.entities(tag.id);
  }
  loading.value = false;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(load);
watch(() => route.params.name, load);
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <header class="flex items-center gap-3">
      <RouterLink to="/tags" class="text-sm text-slate-warm hover:text-ink">&larr; Tags</RouterLink>
      <div class="flex-1" />
    </header>

    <div class="flex items-center gap-3">
      <h1 class="text-3xl font-serif text-ink">Tagged</h1>
      <TagChip :tag="tagName" />
    </div>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <template v-else>
      <section v-if="data.clients.length">
        <h2 class="font-serif text-lg text-ink mb-2">Clients</h2>
        <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
          <li
            v-for="(c, idx) in data.clients"
            :key="c.id"
            @click="router.push(`/clients/${c.id}`)"
            :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-3', idx > 0 && 'border-t border-sand/60']"
          >
            <ClientChip :client="c" size="sm" />
            <StatusBadge :status="c.status" variant="client" class="ml-auto" />
          </li>
        </ul>
      </section>

      <section v-if="data.projects.length">
        <h2 class="font-serif text-lg text-ink mb-2">Projects</h2>
        <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
          <li
            v-for="(p, idx) in data.projects"
            :key="p.id"
            @click="router.push(`/projects/${p.id}`)"
            :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-3', idx > 0 && 'border-t border-sand/60']"
          >
            <span class="flex-1 truncate">{{ p.name }}</span>
            <StatusBadge :status="p.status" variant="project" />
          </li>
        </ul>
      </section>

      <section v-if="data.meetings.length">
        <h2 class="font-serif text-lg text-ink mb-2">Meetings</h2>
        <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
          <li
            v-for="(m, idx) in data.meetings"
            :key="m.id"
            @click="router.push(`/meetings/${m.id}`)"
            :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-3', idx > 0 && 'border-t border-sand/60']"
          >
            <span class="flex-1 truncate">{{ m.title }}</span>
            <span class="text-xs text-slate-warm">{{ fmtDate(m.date) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="data.notes.length">
        <h2 class="font-serif text-lg text-ink mb-2">Notes</h2>
        <ul class="border border-sand rounded-lg overflow-hidden bg-surface">
          <li
            v-for="(n, idx) in data.notes"
            :key="n.id"
            @click="router.push(`/notes/${n.id}`)"
            :class="['px-4 py-2.5 hover:bg-sand/40 cursor-pointer flex items-center gap-3', idx > 0 && 'border-t border-sand/60']"
          >
            <span class="flex-1 truncate">{{ n.title }}</span>
            <span class="text-xs text-slate-warm">{{ fmtDate(n.created_at) }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!data.clients.length && !data.projects.length && !data.meetings.length && !data.notes.length" class="text-sm text-slate-warm">
        Nothing tagged with #{{ tagName }} yet.
      </p>
    </template>
  </div>
</template>
