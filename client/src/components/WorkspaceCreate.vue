<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { useWorkspaceStore, MODULES } from '../stores/workspace.js';
import WorkspaceIcon from './WorkspaceIcon.vue';
import WorkspaceIconPicker from './WorkspaceIconPicker.vue';

// firstRun = the blocking onboarding gate for a brand-new account.
// edit = an existing workspace object → the modal edits it instead of creating.
const props = defineProps({
  firstRun: { type: Boolean, default: false },
  edit: { type: Object, default: null },
});
const emit = defineEmits(['close']);
const ws = useWorkspaceStore();

const COLORS = ['C65D3E', '0F1B2D', '3F6B4C', 'B8863B', '7C5C8A', '3B6B7C'];

const isEdit = computed(() => !!props.edit);
const name = ref(props.edit?.name || '');
const icon = ref(props.edit?.icon || 'sparkles');
const color = ref(props.edit?.color || 'C65D3E');
const nameInput = ref(null);
const saving = ref(false);
const picked = reactive(new Set(props.edit ? (props.edit.sections || []) : ['notes']));

const accent = computed(() => `#${color.value}`);

function toggle(key) { picked.has(key) ? picked.delete(key) : picked.add(key); }

const canSave = computed(() => name.value.trim().length > 0 && !saving.value);

function requestClose() { if (!props.firstRun) emit('close'); }

async function save() {
  const clean = name.value.trim();
  if (!clean) return;
  saving.value = true;
  try {
    const sections = MODULES.filter((m) => picked.has(m.key)).map((m) => m.key);
    if (isEdit.value) {
      await ws.update(props.edit.id, { name: clean, icon: icon.value, color: color.value, sections });
    } else {
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
      await ws.create({ name: clean, slug, icon: icon.value, color: color.value, sections });
    }
    emit('close');
  } finally {
    saving.value = false;
  }
}

onMounted(() => nextTick(() => nameInput.value?.focus()));
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[9vh] px-4" @mousedown.self="requestClose" @keydown.escape="requestClose">
      <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="requestClose" />
      <div class="relative w-full max-w-lg bg-surface border border-sand rounded-xl shadow-2xl overflow-hidden">
        <div class="px-5 pt-5 pb-3">
          <h2 class="font-serif text-xl text-ink">{{ isEdit ? 'Edit workspace' : firstRun ? 'Welcome to Minutes' : 'Create a workspace' }}</h2>
          <p v-if="firstRun" class="text-sm text-slate-warm mt-1">Set up your first workspace to get started.</p>
        </div>

        <!-- Name + live avatar preview -->
        <div class="px-5 pb-3 flex items-end gap-3">
          <div
            class="h-11 w-11 grid place-items-center rounded-lg text-warm text-xl shrink-0"
            :style="{ background: accent }"
          >
            <WorkspaceIcon :icon="icon" />
          </div>
          <div class="flex-1">
            <label class="label" for="ws-name">Name</label>
            <input
              id="ws-name"
              ref="nameInput"
              v-model="name"
              placeholder="e.g. Freelance, Personal, Acme Inc."
              class="input"
              @keydown.enter.prevent="canSave && save()"
            />
          </div>
        </div>

        <!-- Icon + color -->
        <div class="px-5 pb-3">
          <p class="label">Icon</p>
          <WorkspaceIconPicker v-model="icon" :accent="accent" />
          <div class="flex items-center gap-2 mt-3">
            <button
              v-for="c in COLORS"
              :key="c"
              type="button"
              @click="color = c"
              :style="{ background: `#${c}` }"
              :class="['h-6 w-6 rounded-full border-2 transition-transform hover:scale-110', color === c ? 'border-ink' : 'border-transparent']"
            />
          </div>
        </div>

        <!-- Modules -->
        <div class="px-5 pb-2">
          <p class="text-sm text-slate-warm mb-2">Choose what you want to track — add or remove any of these anytime.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="m in MODULES"
              :key="m.key"
              type="button"
              @click="toggle(m.key)"
              :class="[
                'text-left rounded-lg border p-3 flex items-start gap-3 transition-colors',
                picked.has(m.key) ? 'border-terracotta bg-terracotta/5' : 'border-sand hover:border-slate-warm/40',
              ]"
            >
              <span
                :class="['h-8 w-8 grid place-items-center rounded-md shrink-0 text-sm',
                         picked.has(m.key) ? 'bg-terracotta text-white' : 'bg-sand text-slate-warm']"
              >{{ m.icon }}</span>
              <span class="flex-1 min-w-0">
                <span class="flex items-center gap-1.5">
                  <span class="font-medium text-ink">{{ m.label }}</span>
                  <span v-if="picked.has(m.key)" class="ml-auto text-terracotta text-xs">✓</span>
                </span>
                <span class="block text-xs text-slate-warm leading-snug mt-0.5">{{ m.desc }}</span>
              </span>
            </button>
          </div>
          <p class="text-[11px] text-slate-warm mt-2">Todos and the dashboard span every workspace — always on.</p>
        </div>

        <div class="px-5 py-3 border-t border-sand flex items-center justify-between">
          <span class="text-xs text-slate-warm">{{ picked.size }} module{{ picked.size === 1 ? '' : 's' }} selected</span>
          <div class="flex items-center gap-2">
            <button v-if="!firstRun" class="btn-ghost text-sm" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-sm" :disabled="!canSave" @click="save">{{ isEdit ? 'Save changes' : 'Create workspace' }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
