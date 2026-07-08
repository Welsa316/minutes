<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useRoute } from 'vue-router';
import { ideas as api, projects as projectsApi } from '../api/endpoints.js';
import Skeleton from '../components/Skeleton.vue';
import AnimatedCheck from '../components/AnimatedCheck.vue';
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();
const route = useRoute();

const items = ref([]);
const loading = ref(true);
const selectedId = ref(null);
const newTitle = ref('');
const trackEl = ref(null);

// The selected idea opens in a full-screen focus view: phases on a left rail,
// the active phase's plan expanded on a right timeline.
const phases = ref([]);
const activePhaseId = ref(null);
const newPhase = ref('');
const newStepText = ref({});
const focusScroll = ref(null);

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
function progressOf(i) {
  const total = Number(i.step_total || 0);
  if (total > 0) return Math.round((Number(i.step_done || 0) / total) * 100);
  return i.lane === 'shipped' ? 100 : 0;
}
const avgProgress = computed(() => {
  if (!items.value.length) return 0;
  return Math.round(items.value.reduce((s, i) => s + progressOf(i), 0) / items.value.length);
});

// A phase is "done" once it has steps and they're all checked; the first phase
// that isn't done is the one you're on now.
const phaseFull = (p) => p.steps.length > 0 && p.steps.every((s) => s.done);
const activePhaseId_derived = computed(() => (phases.value.find((p) => !phaseFull(p)) || {}).id ?? null);
function phaseState(p) {
  if (phaseFull(p)) return 'done';
  if (p.id === activePhaseId_derived.value) return 'active';
  return 'upcoming';
}
const PHASE_LABEL = { done: 'Done', active: 'In progress', upcoming: 'Upcoming' };
function phasePct(p) {
  const t = p.steps.length;
  return t ? Math.round((p.steps.filter((s) => s.done).length / t) * 100) : 0;
}
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

function close() { selectedId.value = null; }

// --- the plan: phases + their steps (loaded when an idea is focused) ---
let phasesReq = 0;
async function loadPhases(id) {
  const req = ++phasesReq;
  phases.value = [];
  activePhaseId.value = null;
  if (!id) return;
  try {
    const rows = await api.phases(id);
    if (req !== phasesReq) return;
    phases.value = rows;
    const idea = selected.value;
    if (idea && idea.id === id) {
      idea.step_total = rows.reduce((s, p) => s + p.steps.length, 0);
      idea.step_done = rows.reduce((s, p) => s + p.steps.filter((x) => x.done).length, 0);
    }
    // Open the phase you're on (or the first) by default.
    const act = rows.find((p) => !phaseFull(p)) || rows[0];
    activePhaseId.value = act ? act.id : null;
    scrollToActive();
  } catch { if (req === phasesReq) phases.value = []; }
}
watch(selectedId, (id) => loadPhases(id));

// Smoothly bring the open phase to the top of the right column.
function scrollToActive() {
  nextTick(() => {
    const c = focusScroll.value;
    const el = c && c.querySelector('.titem.open');
    if (!c || !el) return;
    const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 16;
    c.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' });
  });
}
function selectPhase(p) {
  if (activePhaseId.value === p.id) return;
  activePhaseId.value = p.id;
  scrollToActive();
}

function bumpCounts(idea, dTotal, dDone) {
  if (!idea) return;
  idea.step_total = Number(idea.step_total || 0) + dTotal;
  idea.step_done = Number(idea.step_done || 0) + dDone;
}

// Each handler captures its idea BEFORE the await, so switching ideas mid-request
// updates the right node's counts and never lands work on the wrong plan.
async function addPhase() {
  const title = newPhase.value.trim();
  const idea = selected.value;
  if (!title || !idea) return;
  newPhase.value = '';
  try {
    const p = await api.addPhase(idea.id, title);
    if (selected.value === idea && !phases.value.some((x) => x.id === p.id)) {
      phases.value.push(p); activePhaseId.value = p.id; scrollToActive();
    }
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
  if (activePhaseId.value === p.id) activePhaseId.value = (phases.value[i] || phases.value[i - 1] || {}).id ?? null;
  const t = p.steps.length, d = p.steps.filter((s) => s.done).length;
  bumpCounts(idea, -t, -d);
  try { await api.removePhase(p.id); toast.show('Phase removed', { kind: 'info', ttl: 4000 }); }
  catch {
    // Only restore into the live list if this idea is still open — otherwise the
    // stale phase would land on whatever idea the user has switched to.
    if (selected.value === idea && i > -1) phases.value.splice(i, 0, p);
    bumpCounts(idea, t, d);
    toast.error('Delete failed');
  }
}

// --- reorder (drag or keyboard buttons), rolling back to the pre-move order on failure ---
let phasePrevIds = null;
function onPhaseDragStart() { phasePrevIds = phases.value.map((p) => p.id); }
async function persistPhases(prevIds) {
  const idea = selected.value;
  if (!idea) return;
  try { await api.reorderPhases(idea.id, phases.value.map((p) => p.id)); }
  catch {
    toast.error('Reorder failed');
    if (prevIds && selected.value === idea) {
      const byId = new Map(phases.value.map((p) => [p.id, p]));
      phases.value = prevIds.map((id) => byId.get(id)).filter(Boolean);
    }
  }
}
function reorderPhases() { persistPhases(phasePrevIds); phasePrevIds = null; }
function movePhase(p, dir) {
  const i = phases.value.indexOf(p), j = i + dir;
  if (i < 0 || j < 0 || j >= phases.value.length) return;
  const prev = phases.value.map((x) => x.id);
  const arr = phases.value.slice();
  arr.splice(j, 0, arr.splice(i, 1)[0]);
  phases.value = arr;
  persistPhases(prev);
}

async function addStep(p) {
  const label = (newStepText.value[p.id] || '').trim();
  const idea = selected.value;
  if (!label || !idea) return;
  newStepText.value[p.id] = '';
  try {
    const s = await api.addStep(p.id, label);
    bumpCounts(idea, 1, 0);
    if (selected.value === idea && phases.value.includes(p)) p.steps.push(s);
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
async function editStepNote(s, note) {
  const prev = s.note; s.note = note;
  try { await api.updateStep(s.id, { note }); }
  catch { s.note = prev; toast.error('Save failed'); }
}
async function removeStep(p, s) {
  const idea = selected.value;
  const i = p.steps.indexOf(s);
  if (i > -1) p.steps.splice(i, 1);
  bumpCounts(idea, -1, s.done ? -1 : 0);
  try { await api.removeStep(s.id); }
  catch {
    // If a concurrent removePhase already dropped this phase, don't re-inflate the
    // idea's counts against steps that no longer exist.
    if (phases.value.includes(p)) { if (i > -1) p.steps.splice(i, 0, s); bumpCounts(idea, 1, s.done ? 1 : 0); }
    toast.error('Delete failed');
  }
}
let stepPrev = null;
function onStepDragStart(p) { stepPrev = { p, ids: p.steps.map((s) => s.id) }; }
async function persistSteps(p, prevIds) {
  try { await api.reorderSteps(p.id, p.steps.map((s) => s.id)); }
  catch {
    toast.error('Reorder failed');
    if (prevIds && phases.value.includes(p)) {
      const byId = new Map(p.steps.map((s) => [s.id, s]));
      p.steps = prevIds.map((id) => byId.get(id)).filter(Boolean);
    }
  }
}
function reorderSteps(p) { persistSteps(p, stepPrev && stepPrev.p === p ? stepPrev.ids : null); stepPrev = null; }
function moveStep(p, s, dir) {
  const i = p.steps.indexOf(s), j = i + dir;
  if (i < 0 || j < 0 || j >= p.steps.length) return;
  const prev = p.steps.map((x) => x.id);
  const arr = p.steps.slice();
  arr.splice(j, 0, arr.splice(i, 1)[0]);
  p.steps = arr;
  persistSteps(p, prev);
}

// Lock body scroll, move focus into the dialog on open and back on close, and
// wire Escape while the focus view is open.
const dialogEl = ref(null);
let lastFocused = null;
watch(() => !!selected.value, (open) => {
  if (typeof document !== 'undefined') document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) {
    lastFocused = typeof document !== 'undefined' ? document.activeElement : null;
    nextTick(() => { (dialogEl.value?.querySelector('.fh-close') || dialogEl.value)?.focus(); });
  } else if (lastFocused && lastFocused.focus) {
    lastFocused.focus();
    lastFocused = null;
  }
});
// Keep Tab focus inside the open dialog.
function trapTab(e) {
  const el = dialogEl.value;
  if (!el) return;
  const nodes = [...el.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && (n.offsetWidth > 0 || n.offsetHeight > 0));
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function onKey(e) { if (e.key === 'Escape' && selected.value) close(); }
onMounted(async () => {
  window.addEventListener('keydown', onKey);
  await load();
  // Deep-link: /roadmap?idea=123 (e.g. from a meeting) opens that plan's focus view.
  const q = Number(route.query.idea);
  if (q && items.value.some((i) => i.id === q)) selectedId.value = q;
});
onUnmounted(() => { window.removeEventListener('keydown', onKey); if (typeof document !== 'undefined') document.documentElement.style.overflow = ''; });
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

          <form class="node add" @submit.prevent="addIdea">
            <input v-model="newTitle" placeholder="Define an idea…" class="add-input" />
            <button type="submit" class="add-btn" :disabled="!newTitle.trim()" aria-label="Add idea">＋</button>
          </form>
        </div>
      </section>

      <p class="hint">Open an idea to plan it — phases on the left, the steps on the right.</p>
    </template>

    <!-- Full-screen focus view -->
    <Teleport to="body">
      <Transition name="focus">
        <div v-if="selected" ref="dialogEl" class="focus" role="dialog" aria-modal="true" :aria-label="selected.title" @keydown.tab="trapTab">
          <header class="focus-head">
            <div class="fh-inner">
              <button class="fh-close" @click="close" aria-label="Close">✕</button>
              <div class="fh-title-wrap">
                <input
                  class="fh-title"
                  :value="selected.title"
                  @change="patch(selected, { title: $event.target.value.trim() || selected.title })"
                />
                <div class="fh-sub">
                  <span :class="['drill-badge', `tone-${stageOf(selected).tone}`]">{{ stageOf(selected).label }}</span>
                  <span class="tabular-nums">{{ phasesDone }}/{{ phases.length }} phases · {{ stepStats.done }}/{{ stepStats.total }} steps · {{ stepStats.pct }}%</span>
                </div>
              </div>
            </div>
            <div class="fh-bar"><span class="fill" :style="{ width: stepStats.pct + '%' }" /></div>
          </header>

          <div class="focus-body">
            <!-- LEFT: phase rail -->
            <aside class="focus-nav">
              <VueDraggable v-model="phases" handle=".pcard-grip" animation="180" class="pcards" @start="onPhaseDragStart" @end="reorderPhases">
                <div
                  v-for="(p, pi) in phases"
                  :key="p.id"
                  class="pcard"
                  :class="[`state-${phaseState(p)}`, { active: p.id === activePhaseId }]"
                  :style="{ '--i': pi }"
                  role="button"
                  tabindex="0"
                  :aria-current="p.id === activePhaseId ? 'true' : undefined"
                  @click="selectPhase(p)"
                  @keydown.enter.self="selectPhase(p)"
                  @keydown.space.self.prevent="selectPhase(p)"
                >
                  <div class="pcard-reorder">
                    <button type="button" class="pmove" @click.stop="movePhase(p, -1)" :disabled="pi === 0" aria-label="Move phase up" title="Move up">↑</button>
                    <button type="button" class="pmove" @click.stop="movePhase(p, 1)" :disabled="pi === phases.length - 1" aria-label="Move phase down" title="Move down">↓</button>
                    <span class="pcard-grip" @click.stop title="Drag to reorder">⠿</span>
                  </div>
                  <div class="pcard-idx">Phase {{ pi + 1 }}</div>
                  <input
                    class="pcard-title"
                    :value="p.title"
                    @change="editPhase(p, { title: $event.target.value })"
                    @click.stop @mousedown.stop
                    placeholder="Name this phase…"
                  />
                  <div class="pcard-foot">
                    <span class="pcard-count tabular-nums" v-if="p.steps.length">{{ p.steps.filter((s) => s.done).length }}/{{ p.steps.length }}</span>
                    <span class="ppill" :class="phaseState(p)">{{ PHASE_LABEL[phaseState(p)] }}</span>
                    <span class="pcard-bar"><span :style="{ width: phasePct(p) + '%' }" /></span>
                  </div>
                </div>
              </VueDraggable>

              <form class="pcard add" @submit.prevent="addPhase">
                <div class="pcard-idx">＋ New phase</div>
                <input v-model="newPhase" placeholder="Now, Next, Launch…" />
              </form>
            </aside>

            <!-- RIGHT: detail timeline -->
            <section class="focus-detail" ref="focusScroll">
              <div class="tline">
                <div
                  v-for="(p, pi) in phases"
                  :key="p.id"
                  class="titem"
                  :class="[`state-${phaseState(p)}`, { open: p.id === activePhaseId }]"
                >
                  <div class="tgutter"><span class="tdot" /></div>
                  <div class="titem-main">
                    <button class="titem-head" @click="selectPhase(p)">
                      <span class="titem-n tabular-nums">{{ pi + 1 }}</span>
                      <span class="titem-title">{{ p.title || 'Untitled phase' }}</span>
                      <span class="titem-count tabular-nums" v-if="p.steps.length">{{ p.steps.filter((s) => s.done).length }}/{{ p.steps.length }}</span>
                      <span class="ppill" :class="phaseState(p)">{{ PHASE_LABEL[phaseState(p)] }}</span>
                      <span class="titem-chev" aria-hidden="true">▸</span>
                    </button>

                    <div class="titem-collapse">
                      <div class="titem-inner">
                        <textarea
                          :value="p.note || ''"
                          @change="editPhase(p, { note: $event.target.value || null })"
                          rows="2"
                          placeholder="Brief — the why and the how. Who, what, by when?"
                          class="pnote"
                        />

                        <VueDraggable v-model="p.steps" handle=".sgrip" animation="150" class="steps" @start="onStepDragStart(p)" @end="reorderSteps(p)">
                          <div v-for="(s, si) in p.steps" :key="s.id" class="step">
                            <div class="step-row">
                              <span class="sgrip" title="Drag to reorder">⠿</span>
                              <button type="button" class="acheck-btn" :class="{ on: s.done }" role="checkbox" :aria-checked="s.done" @click="toggleStep(p, s)" :aria-label="s.done ? 'Mark not done' : 'Mark done'">
                                <AnimatedCheck :checked="s.done" :size="20" />
                              </button>
                              <input :value="s.label" @change="editStep(s, $event.target.value)" :class="['slabel', { done: s.done }]" />
                              <button type="button" class="smove" @click="moveStep(p, s, -1)" :disabled="si === 0" aria-label="Move step up" title="Move up">↑</button>
                              <button type="button" class="smove" @click="moveStep(p, s, 1)" :disabled="si === p.steps.length - 1" aria-label="Move step down" title="Move down">↓</button>
                              <button type="button" class="sdel" @click="removeStep(p, s)" title="Remove step">✕</button>
                            </div>
                            <textarea
                              :value="s.note || ''"
                              @change="editStepNote(s, $event.target.value || null)"
                              class="snote"
                              rows="1"
                              placeholder="Add detail — what exactly, and how you’ll know it’s done"
                            />
                          </div>
                        </VueDraggable>

                        <form @submit.prevent="addStep(p)" class="step-row step-add">
                          <span class="sgrip" style="visibility:hidden">⠿</span>
                          <span class="scheck ghost">＋</span>
                          <input v-model="newStepText[p.id]" placeholder="Add a step…" class="slabel" />
                        </form>
                      </div>
                    </div>
                  </div>
                </div>

                <p v-if="!phases.length" class="tline-empty">No phases yet — add the first one on the left to start the plan.</p>
              </div>

              <footer class="focus-foot">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label class="meta-box">
                    <span class="meta-label">Stage</span>
                    <select :value="selected.lane" @change="setStage(selected, $event.target.value)" class="meta-select">
                      <option v-for="s in STAGES" :key="s.id" :value="s.id">{{ s.label }}</option>
                    </select>
                  </label>
                  <div class="meta-box">
                    <span class="meta-label">Effort</span>
                    <div class="flex items-center gap-1">
                      <button v-for="e in EFFORTS" :key="e.id" type="button" @click="setEffort(selected, e.id)" :class="['eff', { on: (selected.effort || '') === e.id }]">{{ e.label }}</button>
                    </div>
                  </div>
                  <div class="meta-box">
                    <span class="meta-label">Demand</span>
                    <span class="text-lg text-ink">{{ Number(selected.demand) > 0 ? `🔥 ${selected.demand}` : '—' }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-sand">
                  <button @click="destroy(selected)" class="text-sm text-slate-warm hover:text-terracotta">Delete idea</button>
                  <button v-if="!selected.project_id" @click="convert(selected)" class="btn-primary text-sm">→ Turn into a project</button>
                  <span v-else class="text-sm text-slate-warm">▤ Linked to a project</span>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* --- pulse track --- */
.track-wrap { position: relative; }
.track-glow {
  position: absolute; inset: 0; pointer-events: none; border-radius: 1rem; opacity: 0.5;
  background: linear-gradient(90deg, rgb(var(--c-terracotta) / 0.06) 0%, transparent 45%, rgb(var(--c-terracotta) / 0.06) 100%);
}
.track { display: flex; align-items: stretch; gap: 1rem; overflow-x: auto; padding: 1.25rem 0.25rem; cursor: grab; scrollbar-width: none; }
.track:active { cursor: grabbing; }
.track::-webkit-scrollbar { display: none; }
.hint { text-align: center; font-size: 0.8rem; color: rgb(var(--c-slate-warm) / 0.8); }

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
.tone-active .dot, .tone-active .node-top .stage { color: rgb(var(--c-terracotta)); }
.tone-active .dot { background: rgb(var(--c-terracotta)); box-shadow: 0 0 8px rgb(var(--c-terracotta) / 0.7); animation: pulse 1.8s ease-in-out infinite; }
.tone-plan .dot { background: #B8863B; }
.tone-done .dot { background: #3F6B4C; }
.tone-done .fill, .tone-done .node.sel .fill { background: #3F6B4C; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .tone-active .dot { animation: none; } }

.node.add { border-style: dashed; background: transparent; align-items: center; justify-content: center; gap: 0.6rem; cursor: default; }
.node.add:hover { transform: none; border-color: rgb(var(--c-terracotta) / 0.5); }
.add-input { width: 100%; text-align: center; background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); }
.add-input::placeholder { color: rgb(var(--c-slate-warm) / 0.6); }
.add-input:focus { outline: none; }
.add-btn { font-size: 1.4rem; line-height: 1; color: rgb(var(--c-slate-warm)); }
.add-btn:hover:not(:disabled) { color: rgb(var(--c-terracotta)); }
.add-btn:disabled { opacity: 0.4; }

.drill-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.25rem 0.55rem; border-radius: 0.4rem; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); white-space: nowrap; }
.drill-badge.tone-active { background: rgb(var(--c-terracotta) / 0.15); color: rgb(var(--c-terracotta)); }
.drill-badge.tone-done { background: rgba(63, 107, 76, 0.15); color: #3F6B4C; }
.drill-badge.tone-plan { background: rgba(184, 134, 59, 0.15); color: #B8863B; }

/* --- full-screen focus view --- */
.focus {
  position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column;
  background: rgb(var(--c-warm)); overflow: hidden;
}
.focus-head {
  flex-shrink: 0; position: relative;
  padding: 1.5rem 2rem 1rem; border-bottom: 1px solid rgb(var(--c-sand));
}
.fh-inner { display: flex; align-items: flex-start; gap: 1rem; max-width: 84rem; margin: 0 auto; width: 100%; }
.fh-close {
  width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: 0.6rem; margin-top: 0.15rem;
  color: rgb(var(--c-slate-warm)); font-size: 1rem; border: 1px solid rgb(var(--c-sand));
  transition: background .15s, color .15s;
}
.fh-close:hover { background: rgb(var(--c-sand) / 0.4); color: rgb(var(--c-ink)); }
.fh-title-wrap { flex: 1; min-width: 0; }
.fh-title { width: 100%; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 2rem; line-height: 1.15; color: rgb(var(--c-ink)); background: transparent; border: 0; }
.fh-title:focus { outline: none; }
.fh-sub { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.4rem; font-size: 0.8rem; color: rgb(var(--c-slate-warm)); }
.fh-bar { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: rgb(var(--c-sand)); }
.fh-bar .fill { background: rgb(var(--c-terracotta)); }

.focus-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 20rem 1fr; max-width: 84rem; margin: 0 auto; width: 100%; }

/* left rail */
.focus-nav { overflow-y: auto; padding: 1.5rem 1.25rem; border-right: 1px solid rgb(var(--c-sand)); }
.pcards { display: flex; flex-direction: column; gap: 0.6rem; }
.pcard {
  position: relative; text-align: left; width: 100%; display: block;
  padding: 0.85rem 0.95rem 0.8rem; border-radius: 0.85rem; cursor: pointer;
  background: rgb(var(--c-surface) / 0.5); border: 1px solid rgb(var(--c-sand)); opacity: 0.72;
  transition: opacity .2s, border-color .2s, background .2s, transform .2s;
  animation: rise .42s cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--i, 0) * 45ms);
}
.pcard:hover { opacity: 1; border-color: rgb(var(--c-slate-warm) / 0.4); }
.pcard.active { opacity: 1; background: rgb(var(--c-surface)); border-color: rgb(var(--c-terracotta)); box-shadow: -3px 0 0 0 rgb(var(--c-terracotta)), 0 10px 30px rgb(var(--c-terracotta) / 0.1); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 0.72; transform: none; } }
.pcard.active { animation: none; }
.pcard:focus-visible { outline: 2px solid rgb(var(--c-terracotta) / 0.6); outline-offset: 2px; }
.pcard-reorder { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; align-items: center; gap: 1px; opacity: 0; transition: opacity .15s; }
.pcard:hover .pcard-reorder, .pcard:focus-within .pcard-reorder { opacity: 1; }
.pmove { width: 1.15rem; height: 1.15rem; display: grid; place-items: center; font-size: 0.68rem; line-height: 1; color: rgb(var(--c-slate-warm)); border-radius: 0.25rem; }
.pmove:hover:not(:disabled) { color: rgb(var(--c-terracotta)); background: rgb(var(--c-sand) / 0.5); }
.pmove:disabled { opacity: 0.3; cursor: default; }
.pcard-grip { cursor: grab; color: rgb(var(--c-slate-warm) / 0.5); font-size: 0.8rem; line-height: 1; }
.pcard-grip:active { cursor: grabbing; }
.pcard-idx { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: rgb(var(--c-slate-warm) / 0.85); margin-bottom: 0.15rem; }
.pcard-title { width: 100%; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1rem; line-height: 1.25; color: rgb(var(--c-ink)); background: transparent; border: 0; padding: 0; }
.pcard-title:focus { outline: none; }
.state-upcoming .pcard-title { color: rgb(var(--c-ink) / 0.7); }
.pcard-foot { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.6rem; }
.pcard-count { font-size: 0.7rem; color: rgb(var(--c-slate-warm)); }
.pcard-bar { flex: 1; height: 3px; border-radius: 999px; background: rgb(var(--c-sand)); overflow: hidden; }
.pcard-bar > span { display: block; height: 100%; border-radius: 999px; background: rgb(var(--c-terracotta)); transition: width .3s ease; }
.state-done .pcard-bar > span { background: #3F6B4C; }
.pcard.add { border-style: dashed; opacity: 1; cursor: default; animation: none; background: transparent; }
.pcard.add:hover { border-color: rgb(var(--c-terracotta) / 0.5); }
.pcard.add input { width: 100%; background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); font-family: 'IBM Plex Serif', Georgia, serif; }
.pcard.add input::placeholder { color: rgb(var(--c-slate-warm) / 0.6); font-family: Inter, sans-serif; }
.pcard.add input:focus { outline: none; }

/* status pill (shared) */
.ppill { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.12rem 0.4rem; border-radius: 999px; white-space: nowrap; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); }
.ppill.active { background: rgb(var(--c-terracotta) / 0.15); color: rgb(var(--c-terracotta)); }
.ppill.done { background: rgba(63, 107, 76, 0.15); color: #3F6B4C; }

/* right timeline */
.focus-detail { overflow-y: auto; padding: 2rem 2.5rem 4rem; }
.tline { position: relative; max-width: 54rem; }
.tline::before { content: ''; position: absolute; left: 7px; top: 0.6rem; bottom: 0.6rem; width: 2px; background: rgb(var(--c-sand)); border-radius: 2px; }
.tline-empty { color: rgb(var(--c-slate-warm)); font-size: 0.9rem; padding: 1rem 0 1rem 2rem; }

.titem { position: relative; display: flex; gap: 1rem; padding-bottom: 1.4rem; }
.tgutter { flex: 0 0 16px; display: flex; justify-content: center; padding-top: 0.55rem; }
.tdot { width: 16px; height: 16px; border-radius: 50%; background: rgb(var(--c-warm)); border: 2px solid rgb(var(--c-sand)); z-index: 1; transition: border-color .25s, background .25s, box-shadow .25s; }
.state-done .tdot { background: #3F6B4C; border-color: #3F6B4C; }
.state-active .tdot { border-color: rgb(var(--c-terracotta)); border-width: 3px; }
.titem.open.state-active .tdot { box-shadow: 0 0 0 4px rgb(var(--c-terracotta) / 0.14); }

.titem-main { flex: 1; min-width: 0; }
.titem-head { width: 100%; display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0; text-align: left; cursor: pointer; }
.titem-n { font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.05rem; color: rgb(var(--c-slate-warm)); width: 1.1rem; flex-shrink: 0; }
.titem-title { flex: 1; min-width: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.25rem; line-height: 1.25; color: rgb(var(--c-ink)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state-upcoming .titem-title, .state-upcoming .titem-n { color: rgb(var(--c-ink) / 0.55); }
.titem-count { font-size: 0.72rem; color: rgb(var(--c-slate-warm)); }
.titem-chev { color: rgb(var(--c-slate-warm)); font-size: 0.7rem; transition: transform .28s cubic-bezier(.4, 0, .2, 1); }
.titem.open .titem-chev { transform: rotate(90deg); }

/* the accordion: grid-rows 0fr → 1fr animates height cleanly */
.titem-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .34s cubic-bezier(.4, 0, .2, 1); }
.titem.open .titem-collapse { grid-template-rows: 1fr; }
.titem-inner { overflow: hidden; opacity: 0; transform: translateY(-4px); transition: opacity .28s ease .04s, transform .28s ease .04s; }
.titem.open .titem-inner { opacity: 1; transform: none; }
.titem-inner > * { margin-top: 0.75rem; }

.pnote { width: 100%; background: rgb(var(--c-sand) / 0.25); border: 1px solid rgb(var(--c-sand)); border-radius: 0.6rem; padding: 0.6rem 0.75rem; font-size: 0.88rem; line-height: 1.55; color: rgb(var(--c-slate-warm)); resize: none; }
.pnote:focus { outline: none; color: rgb(var(--c-ink)); box-shadow: 0 0 0 2px rgb(var(--c-terracotta) / 0.35); }

.steps { display: flex; flex-direction: column; gap: 0.55rem; }
.step { padding: 0.1rem 0; }
.step-row { display: flex; align-items: center; gap: 0.5rem; }
.step-add { padding-top: 0.5rem; }
.snote {
  display: block; width: calc(100% - 2.45rem); margin: 0.15rem 0 0 2.45rem;
  background: transparent; border: 0; resize: none; font-family: Inter, sans-serif;
  font-size: 0.83rem; line-height: 1.55; color: rgb(var(--c-slate-warm));
  field-sizing: content; min-height: 1.4rem;
}
.snote::placeholder { color: rgb(var(--c-slate-warm) / 0.45); }
.snote:focus { outline: none; color: rgb(var(--c-ink)); }
/* Empty detail stays hidden until you hover/focus the step — filled detail always shows. */
.step:not(:hover):not(:focus-within) .snote:placeholder-shown { display: none; }
.titem.open .steps .step { animation: stepIn .3s ease both; }
.titem.open .steps .step:nth-child(2) { animation-delay: .03s; }
.titem.open .steps .step:nth-child(3) { animation-delay: .06s; }
.titem.open .steps .step:nth-child(4) { animation-delay: .09s; }
.titem.open .steps .step:nth-child(n+5) { animation-delay: .12s; }
@keyframes stepIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.sgrip { cursor: grab; color: rgb(var(--c-slate-warm) / 0.5); font-size: 0.8rem; line-height: 1; user-select: none; }
.sgrip:active { cursor: grabbing; }
/* animated draw checkbox: colour drives the SVG (currentColor) + transitions with state */
.acheck-btn { flex-shrink: 0; display: grid; place-items: center; color: rgb(var(--c-slate-warm) / 0.5); transition: color .3s ease; }
.acheck-btn.on { color: rgb(var(--c-terracotta)); }
.acheck-btn:hover { color: rgb(var(--c-terracotta) / 0.75); }
.scheck { width: 1.15rem; height: 1.15rem; border-radius: 0.35rem; flex-shrink: 0; border: 1.5px solid rgb(var(--c-sand)); display: grid; place-items: center; color: #fff; transition: background .15s, border-color .15s; }
.scheck.on { background: rgb(var(--c-terracotta)); border-color: rgb(var(--c-terracotta)); }
.scheck.ghost { border-style: dashed; color: rgb(var(--c-slate-warm)); font-size: 0.85rem; }
.slabel { flex: 1; min-width: 0; background: transparent; border: 0; font-size: 0.92rem; color: rgb(var(--c-ink)); padding: 0.2rem 0.25rem; border-radius: 0.3rem; }
.slabel:focus { outline: none; background: rgb(var(--c-sand) / 0.4); }
.slabel.done { color: rgb(var(--c-slate-warm)); text-decoration: line-through; }
.smove { color: rgb(var(--c-slate-warm) / 0.55); font-size: 0.7rem; line-height: 1; padding: 0 1px; opacity: 0; transition: opacity .15s; }
.step:hover .smove, .step:focus-within .smove { opacity: 1; }
.step:hover .smove:disabled, .step:focus-within .smove:disabled { opacity: 0.25; }
.smove:hover:not(:disabled) { color: rgb(var(--c-terracotta)); }
.smove:disabled { cursor: default; }
.sdel { color: rgb(var(--c-slate-warm) / 0.6); font-size: 0.8rem; opacity: 0; transition: opacity .15s; }
.step:hover .sdel, .step:focus-within .sdel { opacity: 1; }
.sdel:hover { color: rgb(var(--c-terracotta)); }

.focus-foot { max-width: 54rem; margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid rgb(var(--c-sand)); }
.meta-box { display: flex; flex-direction: column; gap: 0.35rem; background: rgb(var(--c-sand) / 0.35); border-radius: 0.6rem; padding: 0.6rem 0.75rem; }
.meta-label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(var(--c-slate-warm)); }
.meta-select { background: transparent; border: 0; font-size: 0.9rem; color: rgb(var(--c-ink)); }
.meta-select:focus { outline: none; }
.eff { height: 1.5rem; min-width: 1.5rem; padding: 0 0.35rem; border-radius: 0.35rem; font-size: 0.75rem; background: rgb(var(--c-sand)); color: rgb(var(--c-slate-warm)); }
.eff.on { background: rgb(var(--c-terracotta)); color: #fff; }

/* focus enter/leave */
.focus-enter-active, .focus-leave-active { transition: opacity .3s ease, transform .4s cubic-bezier(.16, 1, .3, 1); }
.focus-enter-from, .focus-leave-to { opacity: 0; transform: translateY(14px) scale(.99); }

/* responsive: stack the rail above the timeline on narrow screens */
@media (max-width: 820px) {
  .focus-head { padding: 1.1rem 1.1rem 0.8rem; }
  .fh-title { font-size: 1.5rem; }
  .focus-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .focus-nav { border-right: 0; border-bottom: 1px solid rgb(var(--c-sand)); padding: 1rem; max-height: 40vh; }
  .focus-detail { padding: 1.25rem 1.1rem 3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .pcard, .titem-inner, .titem.open .steps .step, .focus-enter-active, .focus-leave-active { animation: none !important; transition: none !important; }
  .titem-collapse { transition: none; }
}
</style>
