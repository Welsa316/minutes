<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { meetings, clients, projects } from '../api/endpoints.js';

const router = useRouter();
const allClients = ref([]);
const allProjects = ref([]);

const title = ref('');
const clientId = ref('');
const projectId = ref('');
const location = ref('video');
const date = ref('');

const filteredProjects = computed(() => {
  if (!clientId.value) return allProjects.value;
  return allProjects.value.filter((p) => p.client_id === Number(clientId.value));
});

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

const creating = ref(false);

async function create() {
  if (!title.value.trim()) return;
  creating.value = true;
  try {
    const m = await meetings.create({
      title: title.value.trim(),
      client_id: clientId.value || null,
      project_id: projectId.value || null,
      location: location.value || null,
      date: date.value ? new Date(date.value).toISOString() : null,
    });
    router.replace(`/meetings/${m.id}`);
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  date.value = nowLocal();
  [allClients.value, allProjects.value] = await Promise.all([clients.list(), projects.list()]);
});
</script>

<template>
  <div class="max-w-xl space-y-5">
    <header class="flex items-center gap-4">
      <RouterLink to="/meetings" class="text-sm text-slate-warm hover:text-ink">&larr; Meetings</RouterLink>
    </header>

    <h1 class="text-3xl font-serif text-ink">New meeting</h1>

    <form @submit.prevent="create" class="card space-y-4">
      <div>
        <label class="label" for="title">Title</label>
        <input id="title" v-model="title" required autofocus placeholder="Kickoff with…" class="input" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="client">Client</label>
          <select id="client" v-model="clientId" class="input">
            <option value="">—</option>
            <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="project">Project</label>
          <select id="project" v-model="projectId" class="input">
            <option value="">—</option>
            <option v-for="p in filteredProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="date">When</label>
          <input id="date" v-model="date" type="datetime-local" class="input" />
        </div>
        <div>
          <label class="label" for="location">Where</label>
          <select id="location" v-model="location" class="input">
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="in-person">In person</option>
            <option :value="null">—</option>
          </select>
        </div>
      </div>

      <button type="submit" :disabled="!title.trim() || creating" class="btn-primary w-full">
        {{ creating ? 'Creating…' : 'Create and open' }}
      </button>
    </form>
  </div>
</template>
