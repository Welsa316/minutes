<script setup>
import { ref, computed, watch } from 'vue';
import { parseSmart, toIsoLocal, humanizeDate, humanizeDay } from '../utils/dates.js';

const props = defineProps({
  modelValue: { type: [String, Date, null], default: null },
  placeholder: { type: String, default: 'tomorrow 2pm, next mon…' },
  mode: { type: String, default: 'datetime' }, // datetime | date
});
const emit = defineEmits(['update:modelValue']);

const raw = ref(initialText(props.modelValue));
const parsed = ref(asDate(props.modelValue));

function asDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function initialText(v) {
  const d = asDate(v);
  if (!d) return '';
  return props.mode === 'date'
    ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

watch(() => props.modelValue, (v) => {
  parsed.value = asDate(v);
  if (!document.activeElement || document.activeElement !== inputEl.value) {
    raw.value = initialText(v);
  }
});

const inputEl = ref(null);
const focused = ref(false);

const preview = computed(() => {
  if (!raw.value.trim()) return '';
  const d = parseSmart(raw.value);
  if (!d) return '';
  return props.mode === 'date' ? humanizeDay(d) : humanizeDate(d);
});

function onInput(e) {
  raw.value = e.target.value;
  const d = parseSmart(raw.value);
  parsed.value = d;
  if (d) emit('update:modelValue', props.mode === 'date' ? d.toISOString().slice(0, 10) : d.toISOString());
  else if (!raw.value.trim()) emit('update:modelValue', null);
}

function onBlur() {
  focused.value = false;
  // Normalize the visible text
  if (parsed.value) raw.value = initialText(parsed.value);
  else if (!raw.value.trim()) {
    emit('update:modelValue', null);
  } else {
    // Couldn't parse; revert
    raw.value = initialText(props.modelValue);
  }
}

function clear() {
  raw.value = '';
  parsed.value = null;
  emit('update:modelValue', null);
}
</script>

<template>
  <div class="relative">
    <input
      ref="inputEl"
      :value="raw"
      @input="onInput"
      @focus="focused = true"
      @blur="onBlur"
      :placeholder="placeholder"
      class="input pr-7"
    />
    <button
      v-if="raw"
      type="button"
      @mousedown.prevent="clear"
      class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-warm hover:text-terracotta w-5 h-5 leading-none"
      title="Clear"
    >×</button>
    <p
      v-if="focused && preview && preview !== raw"
      class="absolute left-0 top-full mt-1 text-xs text-slate-warm bg-warm border border-sand rounded px-2 py-1 z-10 shadow-sm"
    >→ {{ preview }}</p>
  </div>
</template>
