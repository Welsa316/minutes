<script setup>
import { computed } from 'vue';
import { startOfWeek, addDays, addWeeks, format, isSameDay, differenceInCalendarDays } from 'date-fns';

const props = defineProps({
  events: { type: Array, default: () => [] }, // [{ date: ISO string }]
  weeks: { type: Number, default: 26 },        // last 26 weeks ≈ 6 months
});

// Bucket events by yyyy-MM-dd
const counts = computed(() => {
  const map = new Map();
  for (const e of props.events) {
    if (!e?.date) continue;
    const key = format(new Date(e.date), 'yyyy-MM-dd');
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
});

const max = computed(() => Math.max(1, ...counts.value.values()));

const grid = computed(() => {
  const end = startOfWeek(new Date(), { weekStartsOn: 1 });
  const start = addWeeks(end, -(props.weeks - 1));
  const cols = [];
  for (let w = 0; w < props.weeks; w++) {
    const colStart = addWeeks(start, w);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(colStart, d);
      const key = format(day, 'yyyy-MM-dd');
      const c = counts.value.get(key) || 0;
      days.push({
        date: day,
        count: c,
        future: day.getTime() > Date.now(),
      });
    }
    cols.push(days);
  }
  return cols;
});

function intensity(count) {
  if (!count) return 0;
  const r = count / max.value;
  if (r > 0.66) return 4;
  if (r > 0.33) return 3;
  if (r > 0.15) return 2;
  return 1;
}

function tooltip(d) {
  const label = format(d.date, 'EEE, MMM d');
  if (!d.count) return label;
  return `${label} — ${d.count} meeting${d.count === 1 ? '' : 's'}`;
}
</script>

<template>
  <div class="overflow-x-auto -mx-1 px-1">
    <div class="flex gap-0.5 min-h-[6.5rem]">
      <div v-for="(col, ci) in grid" :key="ci" class="flex flex-col gap-0.5">
        <div
          v-for="(d, di) in col"
          :key="di"
          :title="tooltip(d)"
          :class="['h-2.5 w-2.5 rounded-sm', `hm-${intensity(d.count)}`, d.future && 'opacity-30']"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hm-0 { background: rgb(var(--c-sand) / 0.5); }
.hm-1 { background: rgb(var(--c-terracotta) / 0.20); }
.hm-2 { background: rgb(var(--c-terracotta) / 0.40); }
.hm-3 { background: rgb(var(--c-terracotta) / 0.70); }
.hm-4 { background: rgb(var(--c-terracotta) / 1); }
</style>
