<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { ideas as api, projects as projectsApi } from '../api/endpoints.js';
import Skeleton from '../components/Skeleton.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const selectedId = ref(null);
const newTitle = ref('');
const trackEl = ref(null);

// The pipeline: ideas flow left → right through these stages.
const STAGES = [
  { id: 'someday', label: 'Someday', tone: 'idle' },
  { id: 'considering', label: 'Considering', tone: 'idle' },
  { id: 'next', label: 'Next', tone: 'plan' },
  { id: 'building', label: 'Building', tone: 'active' },
  { id: 'shipped', label: 'Shipped', tone: 'done' },
];
const ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
const stageOf = (i) => STAGES.find((s) => s.id === i.lane) || STAGES[1];
const EFFORTS = [{ id: '', label: '—' }, { id: 's', label: 'S' }, { id: 'm', label: 'M' }, { id: 'l', label: 'L' }];

// Ordered by pipeline stage, then manual order — so the track reads as a flow.
const ordered = computed(() =>
  [...items.value].sort((a, b) =>
    (ORDER[a.lane] ?? 1) - (ORDER[b.lane] ?? 1) || (a.sort_order - b.sort_order) || (a.id - b.id)),
);
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) || null);
const shipped = computed(() => items.value.filter((i) => i.lane === 'shipped').length);
const avgProgress = computed(() => {
  if (!items.value.length) return 0;
  return Math.round(items.value.reduce((s, i) => s + Number(i.progress || 0), 0) / items.value.length);
});

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function addIdea() {
  const title = newTitle.value.trim();
  if (!title) return;
  const row = await api.create({ title, lane: 'considering' });
  row.demand = 0; row.progress = 0;
  items.value.push(row);
  newTitle.value = '';
  selectedId.value = row.id;
  await nextTick();
}

// Optimistic field save (never overwrite locally-derived fields like demand).
async function patch(idea, body) {
  const prev = { ...idea };
  Object.assign(idea, body);
  try { await api.update(idea.id, body); }
  catch { Object.assign(idea, prev); toast.error('Save failed'); }
}
function setProgress(idea, v) { patch(idea, { progress: clamp(v) }); }
function setStage(idea, lane) { patch(idea, { lane }); }
function setEffort(idea, effort) { patch(idea, { effort: effort || null }); }

async function convert(idea) {
  if (idea.project_id) return;
  try {
    const p = await projectsApi.create({ name: idea.title });
    await patch(idea, { project_id: p.id, lane: 'building' });
    toast.success('Project created');
  } catch { toast.error('Couldn’t create project'); }
}
async function destroy(idea) {
  const idx = items.value.indexOf(idea);
  if (idx > -1) items.value.splice(idx, 1);
  if (selectedId.value === idea.id) selectedId.value = null;
  try {
    await api.remove(idea.id);
    toast.show('Idea deleted', {
      kind: 'info', ttl: 5000,
      action: { label: 'Undo', run: async () => { await api.restore(idea.id); load(); } },
    });
  } catch { toast.error('Delete failed'); load(); }
}

// Drag-to-scroll the track; a real drag suppresses the node click that follows.
let drag = { down: false, startX: 0, scroll: 0, moved: false };
function onDown(e) { drag = { down: true, startX: e.pageX, scroll: trackEl.value?.scrollLeft || 0, moved: false }; }
function onMove(e) {
  if (!drag.down || !trackEl.value) return;
  const dx = e.pageX - drag.startX;
  if (Math.abs(dx) > 4) drag.moved = true;
  trackEl.value.scrollLeft = drag.scroll - dx;
}
function onUp() { drag.down = false; }
function onNodeClick(idea) { if (drag.moved) { drag.moved = false; return; } selectedId.value = idea.id; }

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Roadmap</h1>
      <span class="text-sm text-slate-warm tabular-nums">
        {{ items.length }} idea{{ items.length === 1 ? '' : 's' }} · {{ shipped }} shipped · {{ avgProgress }}% avg
      </span>
    </header>

    <Skeleton v-if="loading" :rows="4" />

    <template v-else>
      <!-- Pulse track -->
      <section class="track-wrap">
        <div class="track-glow" aria-hidden="true" />
        <div
          ref="trackEl"
          class="track"
          @mousedown="onDown"
          @mousemove="onMove"
          @mouseup="onUp"
          @mouseleave="onUp"
        >
          <button
            v-for="idea in ordered"
            :key="idea.id"
            class="node"
            :class="[`tone-${stageOf(idea).tone}`, { sel: idea.id === selectedId }]"
            @click="onNodeClick(idea)"
          >
            <div class="node-top">
              <span class="dot" />
              <span class="stage">{{ stageOf(idea).label }}</span>
              <span v-if="Number(idea.demand) > 0" class="demand" title="requests from feedback">🔥 {{ idea.demand }}</span>
            </div>
            <p class="node-title">{{ idea.title }}</p>
            <div class="node-foot">
              <div class="bar"><span class="fill" :style="{ width: (idea.progress || 0) + '%' }" /></div>
              <span class="pct tabular-nums">{{ idea.progress || 0 }}%</span>
            </div>
          </button>

          <!-- inline add -->
          <form class="node add" @submit.prevent="addIdea">
            <input
              v-model="newTitle"
              placeholder="Define an idea…"
              class="add-input"
            />
            <button type="submit" class="add-btn" :disabled="!newTitle.trim()" aria-label="Add idea">＋</button>
          </form>
        </div>
      </section>

      <!-- Drill-down -->
      <section class="drill">
        <div class="drill-rule"><span /><em>Deep dive</em><span /></div>

        <div v-if="!selected" class="drill-empty">
          <div class="drill-empty-ic">◇</div>
          <p>Select an idea to drill in — set its progress, move it down the pipeline, or ship it.</p>
        </div>

        <div v-else class="drill-card">
          <div class="flex items-start justify-between gap-3 mb-3">
            <input
              :value="selected.title"
              @change="patch(selected, { title: $event.target.value.trim() || selected.title })"
              class="drill-title"
            />
            <span :class="['drill-badge', `tone-${stageOf(selected).tone}`]">{{ stageOf(selected).label }}</span>
          </div>

          <textarea
            :value="selected.note || ''"
            @change="patch(selected, { note: $event.target.value || null })"
            rows="2"
            placeholder="What is this and why does it matter?"
            class="drill-note"
          />

          <!-- progress -->
          <div class="mt-4">
            <div class="flex items-center justify-between text-xs text-slate-warm mb-1.5">
              <span>Progress</span><span class="tabular-nums text-ink font-medium">{{ selected.progress || 0 }}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              :value="selected.progress || 0"
              @input="selected.progress = clamp($event.target.value)"
              @change="setProgress(selected, $event.target.value)"
              class="range"
            />
          </div>

          <!-- meta -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <label class="meta-box">
              <span class="meta-label">Stage</span>
              <select :value="selected.lane" @change="setStage(selected, $event.target.value)" class="meta-select">
                <option v-for="s in STAGES" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>
            </label>
            <div class="meta-box">
              <span class="meta-label">Effort</span>
              <div class="flex items-center gap-1">
                <button
                  v-for="e in EFFORTS" :key="e.id" type="button"
                  @click="setEffort(selected, e.id)"
                  :class="['eff', { on: (selected.effort || '') === e.id }]"
                >{{ e.label }}</button>
              </div>
            </div>
            <div class="meta-box">
              <span class="meta-label">Demand</span>
              <span class="text-lg text-ink">{{ Number(selected.demand) > 0 ? `🔥 ${selected.demand}` : '—' }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between mt-5 pt-3 border-t border-sand">
            <button @click="destroy(selected)" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
            <button
              v-if="!selected.project_id"
              @click="convert(selected)"
              class="btn-primary text-sm"
            >→ Turn into a project</button>
            <span v-else class="text-sm text-slate-warm">▤ Linked to a project</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* --- pulse track --- */
.track-wrap { position: relative; }
.track-glow {
  position: absolute; inset: 0; pointer-events: none; border-radius: 1rem; opacity: 0.5;
  background: linear-gradient(90deg, rgb(var(--c-terracotta) / 0.06) 0%, transparent 45%, rgb(var(--c-terracotta) / 0.06) 100%);
}
.track {
  display: flex; align-items: stretch; gap: 1rem; overflow-x: auto; padding: 1.25rem 0.25rem;
  cursor: grab; scrollbar-width: none;
}
.track:active { cursor: grabbing; }
.track::-webkit-scrollbar { display: none; }

.node {
  flex-shrink: 0; width: 12.5rem; min-height: 11rem; text-align: left;
  display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;
  padding: 1rem 1.1rem; border-radius: 1.25rem; cursor: pointer;
  background: rgb(var(--c-surface) / 0.65); backdrop-filter: blur(14px);
  border: 1px solid rgb(var(--c-sand)); transition: transform .18s, border-color .18s, box-shadow .18s;
}
.node:hover { transform: translateY(-3px); border-color: rgb(var(--c-slate-warm) / 0.4); }
.node.sel { border-color: rgb(var(--c-terracotta)); box-shadow: 0 0 0 1px rgb(var(--c-terracotta) / 0.5), 0 14px 40px rgb(var(--c-terracotta) / 0.18); }

.node-top { display: flex; align-items: center; gap: 0.5rem; }
.node-top .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: rgb(var(--c-slate-warm)); flex-shrink: 0; }
.node-top .stage { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(var(--c-slate-warm)); }
.node-top .demand { margin-left: auto; font-size: 0.7rem; color: rgb(var(--c-terracotta)); }
.node-title { font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.05rem; line-height: 1.2; color: rgb(var(--c-ink)); }
.node-foot { display: flex; align-items: center; gap: 0.5rem; }
.bar { flex: 1; height: 4px; border-radius: 999px; background: rgb(var(--c-sand)); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; background: rgb(var(--c-terracotta)); transition: width .3s ease; }
.pct { font-size: 0.7rem; color: rgb(var(--c-slate-warm)); width: 2.2rem; text-align: right; }

/* tone accents by stage */
.tone-active .dot, .tone-active .node-top .stage { color: rgb(var(--c-terracotta)); }
.tone-active .dot { background: rgb(var(--c-terracotta)); box-shadow: 0 0 8px rgb(var(--c-terracotta) / 0.7); animation: pulse 1.8s ease-in-out infinite; }
.tone-plan .dot { background: #B8863B; }
.tone-done .dot { background: #3F6B4C; }
.tone-done .fill, .tone-done .node.sel .fill { background: #3F6B4C; }
.tone-done .node-title { color: rgb(var(--c-ink)); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .tone-active .dot { animation: none; } }

/* add card */
.node.add {
  border-style: dashed; background: transparent; align-items: center; justify-content: center;
  gap: 0.6rem; cursor: default;
}
.node.add:hover { transform: none; border-color: rgb(var(--c-terracotta) / 0.5); }
.add-input { width: 100%; text-align: center; background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); }
.add-input::placeholder { color: rgb(var(--c-slate-warm) / 0.6); }
.add-input:focus { outline: none; }
.add-btn { font-size: 1.4rem; line-height: 1; color: rgb(var(--c-slate-warm)); }
.add-btn:hover:not(:disabled) { color: rgb(var(--c-terracotta)); }
.add-btn:disabled { opacity: 0.4; }

/* --- drill-down --- */
.drill-rule { display: flex; align-items: center; gap: 0.9rem; margin: 0.5rem 0 1.25rem; }
.drill-rule span { flex: 1; height: 1px; background: rgb(var(--c-sand)); }
.drill-rule em { font-style: normal; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgb(var(--c-slate-warm)); }

.drill-empty { text-align: center; color: rgb(var(--c-slate-warm)); padding: 2.5rem 1rem; max-width: 26rem; margin: 0 auto; }
.drill-empty-ic { font-size: 2rem; opacity: 0.5; margin-bottom: 0.75rem; }
.drill-empty p { font-size: 0.9rem; }

.drill-card {
  max-width: 40rem; margin: 0 auto; padding: 1.5rem;
  background: rgb(var(--c-surface) / 0.7); backdrop-filter: blur(16px);
  border: 1px solid rgb(var(--c-sand)); border-radius: 1rem;
}
.drill-title { flex: 1; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.5rem; color: rgb(var(--c-ink)); background: transparent; border: 0; }
.drill-title:focus { outline: none; }
.drill-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.25rem 0.55rem; border-radius: 0.4rem; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); white-space: nowrap; }
.drill-badge.tone-active { background: rgb(var(--c-terracotta) / 0.15); color: rgb(var(--c-terracotta)); }
.drill-badge.tone-done { background: rgba(63, 107, 76, 0.15); color: #3F6B4C; }
.drill-badge.tone-plan { background: rgba(184, 134, 59, 0.15); color: #B8863B; }
.drill-note { width: 100%; background: transparent; border: 1px solid rgb(var(--c-sand)); border-radius: 0.6rem; padding: 0.6rem 0.75rem; font-size: 0.9rem; color: rgb(var(--c-ink)); resize: none; }
.drill-note:focus { outline: none; box-shadow: 0 0 0 2px rgb(var(--c-terracotta) / 0.4); }

.range { width: 100%; accent-color: rgb(var(--c-terracotta)); cursor: pointer; }
.meta-box { display: flex; flex-direction: column; gap: 0.35rem; background: rgb(var(--c-sand) / 0.35); border-radius: 0.6rem; padding: 0.6rem 0.75rem; }
.meta-label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(var(--c-slate-warm)); }
.meta-select { background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); }
.meta-select:focus { outline: none; }
.eff { height: 1.5rem; min-width: 1.5rem; padding: 0 0.35rem; border-radius: 0.35rem; font-size: 0.75rem; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); }
.eff.on { background: rgb(var(--c-terracotta)); color: #fff; }
</style>
