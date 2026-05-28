<script setup>
import { ref, computed, watch } from 'vue';
import { useTransition, TransitionPresets } from '@vueuse/core';

const props = defineProps({
  value: { type: Number, required: true },
  duration: { type: Number, default: 600 },
});

const source = ref(0);
const tweened = useTransition(source, {
  duration: props.duration,
  transition: TransitionPresets.easeOutQuint,
});

watch(() => props.value, (v) => { source.value = v; }, { immediate: true });

const display = computed(() => Math.round(tweened.value).toLocaleString());
</script>

<template>
  <span class="tabular-nums">{{ display }}</span>
</template>
