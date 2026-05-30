<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { clients, projects, meetings } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';
import { useSettingsStore } from '../stores/settings.js';
import { sounds } from '../utils/sounds.js';

const settings = useSettingsStore();

const router = useRouter();
const toast = useToastStore();

const open = ref(false);
const title = ref('');
const date = ref('');
const location = ref('video');
const clientId = ref('');
const projectId = ref('');
const allClients = ref([]);
const allProjects = ref([]);
const submitting = ref(false);
const inputEl = ref(null);

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

const filteredProjects = computed(() => {
  if (!clientId.value) return allProjects.value;
  return allProjects.value.filter((p) => p.client_id === Number(clientId.value));
});

async function show() {
  open.value = true;
  if (settings.sound) sounds.whoosh();
  title.value = '';
  date.value = nowLocal();
  location.value = 'video';
  clientId.value = '';
  projectId.value = '';
  if (!allClients.value.length) {
    [allClients.value, allProjects.value] = await Promise.all([clients.list(), projects.list()]);
  }
  await nextTick();
  inputEl.value?.focus();
}
function hide() { open.value = false; }

async function submit() {
  if (!title.value.trim()) return;
  submitting.value = true;
  try {
    const m = await meetings.create({
      title: title.value.trim(),
      client_id: clientId.value || null,
      project_id: projectId.value || null,
      location: location.value || null,
      date: date.value ? new Date(date.value).toISOString() : null,
    });
    hide();
    toast.success(`Created "${m.title}"`);
    router.push(`/meetings/${m.id}`);
  } catch (e) {
    toast.error('Failed to create meeting');
  } finally {
    submitting.value = false;
  }
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    open.value ? hide() : show();
    return;
  }
  if (!open.value) return;
  if (e.key === 'Escape') { e.preventDefault(); hide(); }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <Transition name="qa">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4"
        @mousedown.self="hide"
      >
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="hide" />
        <form
          @submit.prevent="submit"
          class="relative w-full max-w-md bg-surface border border-sand rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="px-4 pt-4 pb-2 flex items-center justify-between">
            <span class="text-[11px] uppercase tracking-wider text-slate-warm">New meeting</span>
            <kbd class="text-[10px] text-slate-warm border border-sand rounded px-1.5 py-0.5">esc</kbd>
          </div>
          <input
            ref="inputEl"
            v-model="title"
            required
            placeholder="Title…"
            class="w-full px-4 py-2 text-xl font-serif bg-transparent focus:outline-none placeholder-slate-warm/50"
          />

          <div class="px-4 py-2 border-t border-sand grid grid-cols-2 gap-2 text-sm">
            <input
              v-model="date"
              type="datetime-local"
              class="bg-transparent focus:outline-none text-slate-warm focus:text-ink"
            />
            <select v-model="location" class="bg-transparent focus:outline-none text-slate-warm">
              <option value="video">Video</option>
              <option value="phone">Phone</option>
              <option value="in-person">In person</option>
              <option :value="null">—</option>
            </select>
            <select v-model="clientId" class="bg-transparent focus:outline-none text-slate-warm col-span-1">
              <option value="">No client</option>
              <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <select v-model="projectId" class="bg-transparent focus:outline-none text-slate-warm col-span-1">
              <option value="">No project</option>
              <option v-for="p in filteredProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <div class="px-4 py-3 border-t border-sand flex items-center justify-end gap-2">
            <button type="button" @click="hide" class="btn-ghost text-sm">Cancel</button>
            <button type="submit" :disabled="!title.trim() || submitting" class="btn-primary text-sm">
              {{ submitting ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qa-enter-active, .qa-leave-active { transition: opacity 180ms ease; }
.qa-enter-active > form, .qa-leave-active > form {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.qa-enter-from > form { transform: translateY(-12px) scale(0.96); opacity: 0; }
.qa-leave-to > form { transform: translateY(-6px) scale(0.99); opacity: 0; }
.qa-enter-from, .qa-leave-to { opacity: 0; }
</style>
