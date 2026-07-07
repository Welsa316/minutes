<script setup>
import { computed } from 'vue';
import { useRoute, RouterView } from 'vue-router';
import NoteRail from '../components/NoteRail.vue';

const route = useRoute();
// On mobile, one pane at a time: the rail (/notes) or the editor (/notes/:id).
const noteOpen = computed(() => !!route.params.id);
</script>

<template>
  <div class="h-full flex border border-sand rounded-xl overflow-hidden bg-warm">
    <aside
      :class="['h-full w-full lg:w-[300px] lg:shrink-0 border-r border-sand bg-surface/50', noteOpen ? 'hidden lg:block' : 'block']"
    >
      <NoteRail />
    </aside>
    <section :class="['flex-1 min-w-0 h-full', noteOpen ? 'block' : 'hidden lg:block']">
      <RouterView />
    </section>
  </div>
</template>
