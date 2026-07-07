<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { ideas as api, projects as projectsApi } from '../api/endpoints.js';
import Skeleton from '../components/Skeleton.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const selectedId = ref(null);
const newTitle = ref('');
const trackEl = ref(null);

// The selected idea's plan: ordered phases, each with a brief + nested steps.
const phases = ref([]);
const openPhases = ref({});
const newPhase = ref('');
const newStepText = ref({});

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
// Progress = share of the idea's steps that are done (falls back to the stored
// value for an idea that has no steps yet).
function progressOf(i) {
  const total = Number(i.step_total || 0);
  if (total > 0) return Math.round((Number(i.step_done || 0) / total) * 100);
  return Number(i.progress || 0);
}
const avgProgress = computed(() => {
  if (!items.value.length) return 0;
  return Math.round(items.value.reduce((s, i) => s + progressOf(i), 0) / items.value.length);
});

// A phase is "done" once it has steps and they're all checked; the first phase
// that isn't done is the one you're on now.
const phaseFull = (p) => p.steps.length > 0 && p.steps.every((s) => s.done);
const activePhaseId = computed(() => (phases.value.find((p) => !phaseFull(p)) || {}).id ?? null);
function phaseState(p) {
  if (phaseFull(p)) return 'done';
  if (p.id === activePhaseId.value) return 'active';
  return 'upcoming';
}
const PHASE_LABEL = { done: 'Done', active: 'In progress', upcoming: 'Upcoming' };
const stepStats = computed(() => {
  const total = phases.value.reduce((s, p) => s + p.steps.length, 0);
  const done = phases.value.reduce((s, p) => s + p.steps.filter((x) => x.done).length, 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
});
const phasesDone = computed(() => phases.value.filter(phaseFull).length);

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function addIdea() {
  const title = newTitle.value.trim();
  if (!title) return;
  const row = await api.create({ title, lane: 'considering' });
  row.demand = 0; row.progress = 0; row.step_total = 0; row.step_done = 0;
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

// --- the plan: phases + their steps ---
// A monotonic token so a slow response for a previously-selected idea can't
// overwrite the plan of the one now selected.
let phasesReq = 0;
async function loadPhases(id) {
  const req = ++phasesReq;
  phases.value = [];
  openPhases.value = {};
  if (!id) return;
  try {
    const rows = await api.phases(id);
    if (req !== phasesReq) return;
    phases.value = rows;
    // Reconcile the cached node counts with the authoritative phase totals.
    const idea = selected.value;
    if (idea && idea.id === id) {
      idea.step_total = rows.reduce((s, p) => s + p.steps.length, 0);
      idea.step_done = rows.reduce((s, p) => s + p.steps.filter((x) => x.done).length, 0);
    }
    // Open the phase you're on (or the first) by default.
    const act = rows.find((p) => !phaseFull(p)) || rows[0];
    if (act) openPhases.value = { [act.id]: true };
  } catch { if (req === phasesReq) phases.value = []; }
}
watch(selectedId, (id) => loadPhases(id));

function bumpCounts(idea, dTotal, dDone) {
  if (!idea) return;
  idea.step_total = Number(idea.step_total || 0) + dTotal;
  idea.step_done = Number(idea.step_done || 0) + dDone;
}
function togglePhase(p) { openPhases.value[p.id] = !openPhases.value[p.id]; }

// Each handler captures its idea BEFORE the await, so switching ideas mid-request
// updates the right node's counts and never lands work on the wrong plan.
async function addPhase() {
  const title = newPhase.value.trim();
  const idea = selected.value;
  if (!title || !idea) return;
  newPhase.value = '';
  try {
    const p = await api.addPhase(idea.id, title);
    if (selected.value === idea) { phases.value.push(p); openPhases.value[p.id] = true; }
  } catch { toast.error('Couldn’t add phase'); }
}
async function editPhase(p, body) {
  const prev = { title: p.title, note: p.note };
  Object.assign(p, body);
  try { await api.updatePhase(p.id, body); }
  catch { Object.assign(p, prev); toast.error('Save failed'); }
}
async function removePhase(p) {
  const idea = selected.value;
  const i = phases.value.indexOf(p);
  if (i > -1) phases.value.splice(i, 1);
  const t = p.steps.length, d = p.steps.filter((s) => s.done).length;
  bumpCounts(idea, -t, -d);
  try { await api.removePhase(p.id); toast.show('Phase removed', { kind: 'info', ttl: 4000 }); }
  catch { if (i > -1) phases.value.splice(i, 0, p); bumpCounts(idea, t, d); toast.error('Delete failed'); }
}
async function reorderPhases() {
  const idea = selected.value;
  if (!idea) return;
  try { await api.reorderPhases(idea.id, phases.value.map((p) => p.id)); }
  catch { toast.error('Reorder failed'); }
}

async function addStep(p) {
  const label = (newStepText.value[p.id] || '').trim();
  const idea = selected.value;
  if (!label || !idea) return;
  newStepText.value[p.id] = '';
  try {
    const s = await api.addStep(p.id, label);
    bumpCounts(idea, 1, 0);
    if (selected.value === idea) p.steps.push(s);
  } catch { toast.error('Couldn’t add step'); }
}
async function toggleStep(p, s) {
  const idea = selected.value;
  s.done = !s.done;
  bumpCounts(idea, 0, s.done ? 1 : -1);
  try { await api.updateStep(s.id, { done: s.done }); }
  catch { s.done = !s.done; bumpCounts(idea, 0, s.done ? 1 : -1); toast.error('Save failed'); }
}
async function editStep(s, label) {
  const prev = s.label; s.label = label;
  try { await api.updateStep(s.id, { label }); }
  catch { s.label = prev; toast.error('Save failed'); }
}
async function removeStep(p, s) {
  const idea = selected.value;
  const i = p.steps.indexOf(s);
  if (i > -1) p.steps.splice(i, 1);
  bumpCounts(idea, -1, s.done ? -1 : 0);
  try { await api.removeStep(s.id); }
  catch { if (i > -1) p.steps.splice(i, 0, s); bumpCounts(idea, 1, s.done ? 1 : 0); toast.error('Delete failed'); }
}
async function reorderSteps(p) {
  try { await api.reorderSteps(p.id, p.steps.map((s) => s.id)); }
  catch { toast.error('Reorder failed'); }
}

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
              <div class="bar"><span class="fill" :style="{ width: progressOf(idea) + '%' }" /></div>
              <span class="pct tabular-nums">{{ progressOf(idea) }}%</span>
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

      <!-- Drill-down: the plan -->
      <section class="drill">
        <div class="drill-rule"><span /><em>Deep dive</em><span /></div>

        <div v-if="!selected" class="drill-empty">
          <div class="drill-empty-ic">◇</div>
          <p>Select an idea to open its plan — break it into phases, give each a brief, and work the steps down.</p>
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
            placeholder="The pitch — what is this and why now?"
            class="drill-note"
          />

          <!-- overall progress -->
          <div class="plan-head">
            <span class="meta-label">Plan</span>
            <span v-if="stepStats.total" class="text-xs tabular-nums text-slate-warm">
              {{ phasesDone }}/{{ phases.length }} phases · {{ stepStats.done }}/{{ stepStats.total }} steps · <span class="text-ink font-medium">{{ stepStats.pct }}%</span>
            </span>
          </div>
          <div v-if="stepStats.total" class="bar mb-3"><span class="fill" :style="{ width: stepStats.pct + '%' }" /></div>

          <!-- the spine -->
          <VueDraggable v-model="phases" handle=".pgrip" animation="160" class="spine" @end="reorderPhases">
            <div v-for="(p, pi) in phases" :key="p.id" class="phase" :class="`state-${phaseState(p)}`">
              <div class="phase-head" @click="togglePhase(p)">
                <span class="pnode"><svg v-if="phaseState(p) === 'done'" viewBox="0 0 24 24" class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                <span class="pidx">Phase {{ pi + 1 }}</span>
                <input
                  :value="p.title"
                  @change="editPhase(p, { title: $event.target.value })"
                  @click.stop @mousedown.stop
                  class="ptitle"
                  placeholder="Name this phase…"
                />
                <span class="pcount tabular-nums" v-if="p.steps.length">{{ p.steps.filter((s) => s.done).length }}/{{ p.steps.length }}</span>
                <span class="ppill" :class="phaseState(p)">{{ PHASE_LABEL[phaseState(p)] }}</span>
                <button type="button" class="pdel" @click.stop="removePhase(p)" title="Remove phase">✕</button>
                <span class="pgrip" @click.stop title="Drag to reorder">⠿</span>
                <span class="pchev" :class="{ open: openPhases[p.id] }" aria-hidden="true">▸</span>
              </div>

              <div v-show="openPhases[p.id]" class="phase-body">
                <textarea
                  :value="p.note || ''"
                  @change="editPhase(p, { note: $event.target.value || null })"
                  rows="2"
                  placeholder="Brief — the why and the how. Who, what, by when?"
                  class="pnote"
                />

                <VueDraggable v-model="p.steps" handle=".sgrip" animation="150" class="space-y-1 mt-2" @end="reorderSteps(p)">
                  <div v-for="s in p.steps" :key="s.id" class="step">
                    <span class="sgrip" title="Drag to reorder">⠿</span>
                    <button type="button" class="scheck" :class="{ on: s.done }" @click="toggleStep(p, s)" :aria-label="s.done ? 'Mark not done' : 'Mark done'">
                      <svg v-if="s.done" viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </button>
                    <input :value="s.label" @change="editStep(s, $event.target.value)" :class="['slabel', { done: s.done }]" />
                    <button type="button" class="sdel" @click="removeStep(p, s)" title="Remove step">✕</button>
                  </div>
                </VueDraggable>

                <form @submit.prevent="addStep(p)" class="step">
                  <span class="sgrip" style="visibility:hidden">⠿</span>
                  <span class="scheck ghost">＋</span>
                  <input v-model="newStepText[p.id]" placeholder="Add a step…" class="slabel" />
                </form>
              </div>
            </div>
          </VueDraggable>

          <form @submit.prevent="addPhase" class="add-phase">
            <span class="pnode ghost">＋</span>
            <input v-model="newPhase" placeholder="Add a phase — Now, Next, Launch…" />
          </form>

          <!-- meta -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
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
  max-width: 42rem; margin: 0 auto; padding: 1.5rem;
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

.plan-head { display: flex; align-items: baseline; justify-content: space-between; margin: 1.1rem 0 0.5rem; }

/* --- the spine --- */
.spine { position: relative; }
.spine::before { content: ''; position: absolute; left: 8px; top: 0.9rem; bottom: 0.9rem; width: 2px; background: rgb(var(--c-sand)); border-radius: 2px; }
.phase { position: relative; }

.phase-head { display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0; cursor: pointer; user-select: none; }
.pnode {
  width: 18px; height: 18px; flex: 0 0 auto; border-radius: 50%; z-index: 1;
  background: rgb(var(--c-warm)); border: 2px solid rgb(var(--c-sand));
  display: grid; place-items: center; color: #fff;
}
.state-active > .phase-head .pnode { border-color: rgb(var(--c-terracotta)); border-width: 3px; }
.state-done > .phase-head .pnode { background: #3F6B4C; border-color: #3F6B4C; }
.pidx { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(var(--c-slate-warm) / 0.8); white-space: nowrap; }
.ptitle { flex: 1; min-width: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.02rem; color: rgb(var(--c-ink)); background: transparent; border: 0; padding: 0.15rem 0.25rem; border-radius: 0.3rem; }
.ptitle:focus { outline: none; background: rgb(var(--c-sand) / 0.4); }
.state-upcoming > .phase-head .ptitle { color: rgb(var(--c-ink) / 0.65); }
.pcount { font-size: 0.72rem; color: rgb(var(--c-slate-warm)); }
.ppill { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.15rem 0.45rem; border-radius: 999px; white-space: nowrap; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); }
.ppill.active { background: rgb(var(--c-terracotta) / 0.15); color: rgb(var(--c-terracotta)); }
.ppill.done { background: rgba(63, 107, 76, 0.15); color: #3F6B4C; }
.pdel { color: rgb(var(--c-slate-warm) / 0.55); font-size: 0.78rem; opacity: 0; transition: opacity .15s; }
.phase-head:hover .pdel { opacity: 1; }
.pdel:hover { color: rgb(var(--c-terracotta)); }
.pgrip { cursor: grab; color: rgb(var(--c-slate-warm) / 0.45); font-size: 0.8rem; line-height: 1; opacity: 0; transition: opacity .15s; }
.phase-head:hover .pgrip { opacity: 1; }
.pgrip:active { cursor: grabbing; }
.pchev { color: rgb(var(--c-slate-warm)); font-size: 0.7rem; transition: transform .18s; }
.pchev.open { transform: rotate(90deg); }

.phase-body { padding: 0.25rem 0 0.75rem 1.6rem; margin-left: 8px; border-left: 2px solid transparent; }
.pnote {
  width: 100%; background: rgb(var(--c-sand) / 0.25); border: 1px solid rgb(var(--c-sand)); border-radius: 0.55rem;
  padding: 0.55rem 0.7rem; font-size: 0.85rem; line-height: 1.5; color: rgb(var(--c-slate-warm)); resize: none;
}
.pnote:focus { outline: none; color: rgb(var(--c-ink)); box-shadow: 0 0 0 2px rgb(var(--c-terracotta) / 0.35); }

/* steps checklist */
.step { display: flex; align-items: center; gap: 0.5rem; padding: 0.15rem 0; }
.sgrip { cursor: grab; color: rgb(var(--c-slate-warm) / 0.5); font-size: 0.8rem; line-height: 1; user-select: none; }
.sgrip:active { cursor: grabbing; }
.scheck {
  width: 1.15rem; height: 1.15rem; border-radius: 0.35rem; flex-shrink: 0;
  border: 1.5px solid rgb(var(--c-sand)); display: grid; place-items: center;
  color: #fff; transition: background .15s, border-color .15s;
}
.scheck.on { background: rgb(var(--c-terracotta)); border-color: rgb(var(--c-terracotta)); }
.scheck.ghost { border-style: dashed; color: rgb(var(--c-slate-warm)); font-size: 0.85rem; }
.slabel {
  flex: 1; min-width: 0; background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink));
  padding: 0.2rem 0.25rem; border-radius: 0.3rem;
}
.slabel:focus { outline: none; background: rgb(var(--c-sand) / 0.4); }
.slabel.done { color: rgb(var(--c-slate-warm)); text-decoration: line-through; }
.sdel { color: rgb(var(--c-slate-warm) / 0.6); font-size: 0.8rem; opacity: 0; transition: opacity .15s; }
.step:hover .sdel { opacity: 1; }
.sdel:hover { color: rgb(var(--c-terracotta)); }

.add-phase { display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0; }
.add-phase .pnode.ghost { border-style: dashed; background: transparent; color: rgb(var(--c-slate-warm)); font-size: 0.8rem; }
.add-phase input { flex: 1; background: transparent; border: 0; font-size: 0.92rem; color: rgb(var(--c-ink)); font-family: 'IBM Plex Serif', Georgia, serif; }
.add-phase input::placeholder { color: rgb(var(--c-slate-warm) / 0.6); font-family: Inter, sans-serif; }
.add-phase input:focus { outline: none; }

.meta-box { display: flex; flex-direction: column; gap: 0.35rem; background: rgb(var(--c-sand) / 0.35); border-radius: 0.6rem; padding: 0.6rem 0.75rem; }
.meta-label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(var(--c-slate-warm)); }
.meta-select { background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); }
.meta-select:focus { outline: none; }
.eff { height: 1.5rem; min-width: 1.5rem; padding: 0 0.35rem; border-radius: 0.35rem; font-size: 0.75rem; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); }
.eff.on { background: rgb(var(--c-terracotta)); color: #fff; }
</style>
