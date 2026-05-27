<script setup>
import { RouterLink } from 'vue-router';

defineEmits(['logout']);

const links = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/clients', label: 'Clients' },
  { to: '/projects', label: 'Projects' },
  { to: '/meetings', label: 'Meetings' },
  { to: '/notes', label: 'Notes' },
];
</script>

<template>
  <aside class="w-60 shrink-0 border-r border-sand bg-warm flex flex-col">
    <div class="px-5 py-5 border-b border-sand flex items-center gap-3">
      <div class="h-8 w-8 grid place-items-center rounded-md bg-ink text-warm font-serif text-lg leading-none">m</div>
      <span class="font-serif text-lg text-ink">Minutes</span>
    </div>

    <nav class="flex-1 py-4 px-3 space-y-1">
      <RouterLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        v-slot="{ isActive, isExactActive, href, navigate }"
        custom
      >
        <a
          :href="href"
          @click="navigate"
          :class="[
            'block px-3 py-2 rounded-md text-sm transition-colors',
            (l.exact ? isExactActive : isActive)
              ? 'bg-sand text-ink font-medium'
              : 'text-slate-warm hover:bg-sand/50 hover:text-ink',
          ]"
        >
          {{ l.label }}
        </a>
      </RouterLink>
    </nav>

    <div class="p-3 border-t border-sand space-y-2">
      <RouterLink
        to="/meetings/new"
        class="btn-primary w-full text-sm"
      >
        + New meeting
      </RouterLink>
      <button class="btn-ghost w-full text-sm" @click="$emit('logout')">Sign out</button>
    </div>
  </aside>
</template>
