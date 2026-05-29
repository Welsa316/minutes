<script setup>
import { watch } from 'vue';
import { useSpeech } from '../composables/useSpeech.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  // 'replace' overwrites the bound value; 'append' adds to it.
  mode: { type: String, default: 'replace' },
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'final']);

const toast = useToastStore();
const speech = useSpeech();

let base = '';
function onResult(text, isFinal) {
  const next = props.mode === 'append' && base ? `${base} ${text}` : text;
  emit('update:modelValue', next);
  if (isFinal) emit('final', next);
}

function toggle() {
  if (!speech.supported) {
    toast.error('Voice input not supported in this browser');
    return;
  }
  if (speech.listening.value) {
    speech.stop();
  } else {
    base = props.modelValue || '';
    speech.start({ interim: true }, onResult);
  }
}

watch(speech.error, (e) => {
  if (e === 'not-allowed') toast.error('Microphone permission denied');
  else if (e && e !== 'aborted' && e !== 'no-speech') toast.error(`Voice: ${e}`);
});
</script>

<template>
  <button
    v-if="speech.supported"
    type="button"
    @click="toggle"
    :title="speech.listening.value ? 'Stop' : 'Dictate'"
    :class="[
      'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors shrink-0',
      speech.listening.value ? 'bg-terracotta text-warm mic-pulse' : 'text-slate-warm hover:bg-sand/60 hover:text-ink',
    ]"
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  </button>
</template>

<style scoped>
.mic-pulse { animation: mic-pulse 1.2s ease-in-out infinite; }
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(var(--c-terracotta) / 0.5); }
  50%      { box-shadow: 0 0 0 6px rgb(var(--c-terracotta) / 0); }
}
@media (prefers-reduced-motion: reduce) { .mic-pulse { animation: none; } }
</style>
