<script setup>
import { computed } from 'vue';
import { format, subWeeks, startOfWeek } from 'date-fns';

const props = defineProps({
  // Array of date strings or Date objects (e.g. meeting dates)
  dates: { type: Array, default: () => [] },
  weeks: { type: Number, default: 12 },
  width: { type: Number, default: 80 },
  height: { type: Number, default: 20 },
  color: { type: String, default: 'currentColor' },
});

const points = computed(() => {
  const buckets = new Array(props.weeks).fill(0);
  const end = startOfWeek(new Date(), { weekStartsOn: 1 });
  for (const raw of props.dates) {
    if (!raw) continue;
    const d = new Date(raw);
    const start = subWeeks(end, props.weeks - 1);
    if (d < start) continue;
    const weekIndex = Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekIndex >= 0 && weekIndex < props.weeks) buckets[weekIndex]++;
  }
  const max = Math.max(1, ...buckets);
  const step = props.width / Math.max(1, props.weeks - 1);
  return buckets.map((v, i) => {
    const x = i * step;
    const y = props.height - (v / max) * props.height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
});

const path = computed(() => `M${points.value.join(' L')}`);
const areaPath = computed(() => `${path.value} L${props.width},${props.height} L0,${props.height} Z`);
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="overflow-visible">
    <path :d="areaPath" :fill="color" fill-opacity="0.12" stroke="none" />
    <path :d="path" :stroke="color" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
