<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { tags as api } from '../api/endpoints.js';
import TagChip from '../components/TagChip.vue';

const router = useRouter();
const items = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl font-serif text-ink">Tags</h1>
      <span class="text-sm text-slate-warm">{{ items.length }}</span>
    </header>

    <div v-if="loading" class="text-sm text-slate-warm">Loading…</div>
    <div v-else-if="!items.length" class="text-sm text-slate-warm">No tags yet. Add tags from any client, project, meeting, or note.</div>
    <ul v-else class="grid grid-cols-2 md:grid-cols-3 gap-2">
      <li
        v-for="t in items"
        :key="t.id"
        @click="router.push(`/tags/${encodeURIComponent(t.name)}`)"
        class="px-3 py-2 border border-sand rounded-md hover:bg-sand/30 cursor-pointer flex items-center justify-between gap-2"
      >
        <TagChip :tag="t.name" />
        <span class="text-xs text-slate-warm">{{ t.usage_count }}</span>
      </li>
    </ul>
  </div>
</template>
