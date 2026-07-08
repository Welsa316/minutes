<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { dashboard } from '../api/endpoints.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { House, Plus, CalendarDays, StickyNote, Users, FolderKanban, TrendingUp, Activity, ArrowUpRight, Info } from 'lucide-vue-next';
import Skeleton from '../components/Skeleton.vue';
import CountUp from '../components/CountUp.vue';
import ClientChip from '../components/ClientChip.vue';

const auth = useAuthStore();
const ws = useWorkspaceStore();
const router = useRouter();

function goHome() { router.push('/home'); }

const upcoming = ref([]);
const active = ref([]);
const recent = ref([]);
const allMeetings = ref([]);
const totals = ref({ clients: 0, projects: 0, meetings: 0, notes: 0 });
const loading = ref(true);

const firstName = computed(() => (auth.user?.name || auth.user?.email?.split('@')[0] || '').split(' ')[0]);
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 5) return `Late night, ${firstName.value}`;
  if (h < 12) return `Good morning, ${firstName.value}`;
  if (h < 17) return `Good afternoon, ${firstName.value}`;
  if (h < 21) return `Good evening, ${firstName.value}`;
  return `Late night, ${firstName.value}`;
});
const dateLine = computed(() =>
  new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' · ' +
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
const multiWorkspace = computed(() => ws.list.length > 1);

// --- derived activity series (all data we have a full time series for is meetings) ---
const dated = computed(() => allMeetings.value.filter((m) => m.date));
function monthKey(d) { const x = new Date(d); return x.getFullYear() * 12 + x.getMonth(); }

const RANGES = [{ label: '3M', n: 3 }, { label: '6M', n: 6 }, { label: '1Y', n: 12 }, { label: 'All', n: 36 }];
const rangeN = ref(12);

const candles = computed(() => {
  const now = new Date();
  const curKey = now.getFullYear() * 12 + now.getMonth();
  const n = rangeN.value;
  const counts = new Array(n).fill(0);
  for (const m of dated.value) {
    const idx = n - 1 - (curKey - monthKey(m.date));
    if (idx >= 0 && idx < n) counts[idx]++;
  }
  return counts.map((c, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { count: c, label: d.toLocaleString(undefined, { month: 'short' }), up: i === 0 ? true : c >= counts[i - 1], current: i === n - 1 };
  });
});
const maxCandle = computed(() => Math.max(1, ...candles.value.map((c) => c.count)));
const windowTotal = computed(() => candles.value.reduce((s, c) => s + c.count, 0));
const avgPerMonth = computed(() => Math.round((windowTotal.value / Math.max(1, candles.value.length)) * 10) / 10);
const peak = computed(() => candles.value.reduce((a, b) => (b.count > a.count ? b : a), candles.value[0] || { count: 0 }));

function inMonth(offset) {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return dated.value.filter((m) => { const x = new Date(m.date); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); }).length;
}
const thisMonth = computed(() => inMonth(0));
const lastMonth = computed(() => inMonth(-1));
function pctDelta(cur, prev) { if (!prev) return cur > 0 ? 100 : 0; return Math.round(((cur - prev) / prev) * 100); }
const meetingsDelta = computed(() => pctDelta(thisMonth.value, lastMonth.value));

// Momentum = share of the last 60 days' meetings that fell in the most recent 30.
const momentum = computed(() => {
  const now = Date.now(), d30 = 30 * 864e5;
  const recent30 = dated.value.filter((m) => now - new Date(m.date) < d30 && now - new Date(m.date) >= 0).length;
  const prior30 = dated.value.filter((m) => { const t = now - new Date(m.date); return t >= d30 && t < 2 * d30; }).length;
  const total = recent30 + prior30;
  return { pct: total ? Math.round((recent30 / total) * 100) : 50, recent30, prior30, delta: pctDelta(recent30, prior30) };
});

// Meetings in the next 7 days → the "this week" needle gauge.
const weekAhead = computed(() => {
  const now = Date.now(), wk = 7 * 864e5;
  return dated.value.filter((m) => { const t = new Date(m.date) - now; return t >= 0 && t <= wk; }).length;
});
const weekPct = computed(() => Math.min(100, Math.round((weekAhead.value / 8) * 100)));

// Weekly buckets for the two small stat sparklines.
function weekly(n) {
  const buckets = new Array(n).fill(0);
  const now = Date.now(), wk = 7 * 864e5;
  const start = now - (n - 1) * wk;
  for (const m of dated.value) {
    const i = Math.floor((new Date(m.date) - start) / wk);
    if (i >= 0 && i < n) buckets[i]++;
  }
  return buckets;
}
const meetingWeeks = computed(() => weekly(10));
const barsSeries = computed(() => candles.value.slice(-9).map((c) => c.count));

const glanceRows = computed(() => [
  { label: 'Clients', value: totals.value.clients, icon: Users, to: '/clients' },
  { label: 'Projects', value: totals.value.projects, icon: FolderKanban, to: '/projects' },
  { label: 'Notes', value: totals.value.notes, icon: StickyNote, to: '/notes' },
]);

// --- tiny SVG helpers (gauges) ---
function pol(cx, cy, r, deg) { const a = (deg * Math.PI) / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; }
function arc(cx, cy, r, start, end) {
  const [x1, y1] = pol(cx, cy, r, start), [x2, y2] = pol(cx, cy, r, end);
  const large = Math.abs(end - start) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
// arc gauge (momentum): 250° sweep, gap at the bottom
const GA_START = -125, GA_SWEEP = 250;
const momentumTrack = computed(() => arc(110, 110, 82, GA_START, GA_START + GA_SWEEP));
const momentumValue = computed(() => arc(110, 110, 82, GA_START, GA_START + GA_SWEEP * (momentum.value.pct / 100)));
// needle gauge (this week): 180° semicircle
const weekTrack = computed(() => arc(100, 100, 78, -90, 90));
const needle = computed(() => { const [x, y] = pol(100, 100, 66, -90 + 180 * (weekPct.value / 100)); return { x, y }; });

// bar chart geometry for the big activity chart
const CHART = { w: 620, h: 260, padL: 8, padR: 8, padT: 24, padB: 26 };
const bars = computed(() => {
  const cs = candles.value;
  const innerW = CHART.w - CHART.padL - CHART.padR;
  const innerH = CHART.h - CHART.padT - CHART.padB;
  const slot = innerW / Math.max(1, cs.length);
  const bw = Math.min(22, slot * 0.42);
  return cs.map((c, i) => {
    const x = CHART.padL + slot * i + slot / 2;
    const bh = (c.count / maxCandle.value) * innerH;
    const y = CHART.padT + innerH - bh;
    return { ...c, x, y, bh: Math.max(2, bh), bw, base: CHART.padT + innerH };
  });
});

async function load() {
  const d = await dashboard.get();
  upcoming.value = d.upcoming;
  active.value = d.activeProjects;
  recent.value = d.recentNotes;
  allMeetings.value = d.allMeetings;
  totals.value = d.totals;
  loading.value = false;
}

function open(kind, item) {
  if (item.workspace_id && item.workspace_id !== ws.activeId) ws.setActive(item.workspace_id);
  router.push(`/${kind}/${item.id}`);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

onMounted(load);
</script>

<template>
  <div class="dash">
    <div class="dash-bg" aria-hidden="true"></div>
    <!-- shared gradient defs for the charts -->
    <svg width="0" height="0" class="absolute" aria-hidden="true"><defs>
      <linearGradient id="gGauge" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stop-color="#e8763e" /><stop offset="55%" stop-color="#f2b134" /><stop offset="100%" stop-color="#35d3c6" />
      </linearGradient>
      <linearGradient id="gNeedle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e8763e" /><stop offset="50%" stop-color="#f2b134" /><stop offset="100%" stop-color="#34d399" />
      </linearGradient>
      <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e8763e" stop-opacity="0.35" /><stop offset="100%" stop-color="#e8763e" stop-opacity="0" />
      </linearGradient>
    </defs></svg>

    <header class="dash-head">
      <div>
        <h1 class="dash-greet">{{ greeting }}</h1>
        <p class="dash-date">{{ dateLine }}</p>
      </div>
      <RouterLink to="/meetings/new" class="dash-cta"><Plus class="h-4 w-4" :stroke-width="2.4" /> New meeting</RouterLink>
    </header>

    <Skeleton v-if="loading" variant="dashboard" />

    <div v-else class="bento">
      <!-- ROW 1 — stat cards -->
      <div class="gcard c-span4 stat">
        <div class="stat-head"><span class="chip chip-orange"><CalendarDays class="h-3.5 w-3.5" /></span> Meetings</div>
        <div class="stat-row">
          <div class="stat-num"><CountUp :value="totals.meetings" /></div>
          <span class="delta" :class="meetingsDelta >= 0 ? 'up' : 'down'"><ArrowUpRight class="h-3 w-3" :class="{ 'rotate-90': meetingsDelta < 0 }" /> {{ meetingsDelta >= 0 ? '+' : '' }}{{ meetingsDelta }}%</span>
        </div>
        <svg class="spark-bars" viewBox="0 0 180 40" preserveAspectRatio="none">
          <rect v-for="(v, i) in meetingWeeks" :key="i" :x="i * (180 / meetingWeeks.length) + 2" :y="40 - Math.max(3, (v / Math.max(1, ...meetingWeeks)) * 38)" :width="180 / meetingWeeks.length - 4" :height="Math.max(3, (v / Math.max(1, ...meetingWeeks)) * 38)" rx="2" fill="#e8763e" :opacity="0.35 + 0.65 * (v / Math.max(1, ...meetingWeeks))" />
        </svg>
      </div>

      <div class="gcard c-span4 stat">
        <div class="stat-head"><span class="chip chip-teal"><TrendingUp class="h-3.5 w-3.5" /></span> This month</div>
        <div class="stat-row">
          <div class="stat-num"><CountUp :value="thisMonth" /></div>
          <span class="delta" :class="meetingsDelta >= 0 ? 'up' : 'down'"><ArrowUpRight class="h-3 w-3" :class="{ 'rotate-90': meetingsDelta < 0 }" /> {{ thisMonth }} vs {{ lastMonth }}</span>
        </div>
        <svg class="spark-bars" viewBox="0 0 180 40" preserveAspectRatio="none">
          <rect v-for="(c, i) in barsSeries" :key="i" :x="i * (180 / barsSeries.length) + 2" :y="40 - Math.max(3, (c / maxCandle) * 38)" :width="180 / barsSeries.length - 4" :height="Math.max(3, (c / maxCandle) * 38)" rx="2" fill="#35d3c6" :opacity="0.35 + 0.65 * (c / maxCandle)" />
        </svg>
      </div>

      <div class="gcard c-span4 gauge-card">
        <div class="stat-head"><span class="chip chip-orange"><Activity class="h-3.5 w-3.5" /></span> Momentum</div>
        <svg viewBox="0 0 220 150" class="gauge-arc">
          <path :d="momentumTrack" stroke="rgba(255,255,255,0.08)" stroke-width="14" fill="none" stroke-linecap="round" />
          <path :d="momentumValue" stroke="url(#gGauge)" stroke-width="14" fill="none" stroke-linecap="round" />
          <text x="110" y="104" class="g-val" text-anchor="middle">{{ momentum.pct }}%</text>
          <text x="110" y="126" class="g-sub" text-anchor="middle">last 30 days</text>
        </svg>
        <div class="gauge-foot" :class="momentum.delta >= 0 ? 'up' : 'down'">{{ momentum.delta >= 0 ? '+' : '' }}{{ momentum.delta }}% vs prior 30d</div>
      </div>

      <!-- ROW 2 — big chart + coming up -->
      <div class="gcard c-span8 chart-card">
        <div class="chart-top">
          <div>
            <div class="chart-title">Activity <span class="muted">· meetings logged</span></div>
            <div class="chart-price"><CountUp :value="windowTotal" /> <span class="muted">in view</span></div>
          </div>
          <div class="range">
            <button v-for="r in RANGES" :key="r.label" @click="rangeN = r.n" :class="['range-b', { on: rangeN === r.n }]">{{ r.label }}</button>
          </div>
        </div>
        <div class="chart-stats">
          <div class="cstat"><span class="muted">This month</span><b>{{ thisMonth }}</b></div>
          <div class="cstat"><span class="muted">Avg / month</span><b>{{ avgPerMonth }}</b></div>
          <div class="cstat"><span class="muted">Workspaces</span><b>{{ ws.list.length }}</b></div>
        </div>
        <svg :viewBox="`0 0 ${CHART.w} ${CHART.h}`" class="chart-svg" preserveAspectRatio="none">
          <line v-for="g in [0.25, 0.5, 0.75]" :key="g" :x1="0" :x2="CHART.w" :y1="CHART.padT + (CHART.h - CHART.padT - CHART.padB) * g" :y2="CHART.padT + (CHART.h - CHART.padT - CHART.padB) * g" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 5" />
          <g v-for="(b, i) in bars" :key="i">
            <line :x1="b.x" :x2="b.x" :y1="b.y - 6" :y2="b.base" :stroke="b.up ? '#e8763e' : '#35d3c6'" stroke-width="1" opacity="0.35" />
            <rect :x="b.x - b.bw / 2" :y="b.y" :width="b.bw" :height="b.bh" :rx="Math.min(5, b.bw / 2)" :fill="b.up ? '#e8763e' : '#35d3c6'" :opacity="b.current ? 1 : 0.85" />
            <rect v-if="b.current" :x="b.x - b.bw / 2 - 2" :y="b.y - 2" :width="b.bw + 4" :height="b.bh + 4" :rx="Math.min(6, b.bw / 2 + 2)" fill="none" stroke="#e8763e" stroke-opacity="0.5" stroke-width="1.5" />
          </g>
        </svg>
        <div class="chart-axis">
          <span v-for="(b, i) in bars" :key="i" :class="{ cur: b.current }">{{ b.label }}</span>
        </div>
      </div>

      <div class="gcard c-span4 up-card">
        <div class="stat-head between"><span><span class="chip chip-orange"><CalendarDays class="h-3.5 w-3.5" /></span> Coming up</span><RouterLink to="/meetings" class="link">All →</RouterLink></div>
        <ul v-if="upcoming.length" class="up-list">
          <li v-for="m in upcoming.slice(0, 5)" :key="m.id">
            <button @click="open('meetings', m)" class="up-row">
              <span class="up-dot" :style="multiWorkspace && m.workspace_color ? { background: '#' + m.workspace_color } : {}" />
              <span class="up-main">
                <span class="up-title">{{ m.title }}</span>
                <span class="up-meta">{{ fmtDate(m.date) }}<template v-if="m.client_name"> · {{ m.client_name }}</template></span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">Nothing scheduled.</p>
        <RouterLink to="/meetings/new" class="up-cta"><Plus class="h-4 w-4" :stroke-width="2.4" /> New meeting</RouterLink>
      </div>

      <!-- ROW 3 — at a glance, week gauge, recent table, mini charts -->
      <div class="gcard c-span3 glance">
        <div class="stat-head between"><span><span class="chip chip-orange">$</span> At a glance</span><RouterLink to="/clients" class="link"><ArrowUpRight class="h-3.5 w-3.5" /></RouterLink></div>
        <div class="glance-big"><CountUp :value="totals.meetings" /> <span class="muted">meetings</span></div>
        <ul class="glance-list">
          <li v-for="r in glanceRows" :key="r.label">
            <RouterLink :to="r.to" class="glance-row">
              <component :is="r.icon" class="h-3.5 w-3.5 muted" />
              <span class="glance-label">{{ r.label }}</span>
              <b class="glance-val">{{ r.value }}</b>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="gcard c-span3 gauge-card">
        <div class="stat-head between"><span>This week</span><Info class="h-3.5 w-3.5 muted" /></div>
        <svg viewBox="0 0 200 120" class="needle-svg">
          <path :d="weekTrack" stroke="rgba(255,255,255,0.08)" stroke-width="12" fill="none" stroke-linecap="round" />
          <path :d="weekTrack" stroke="url(#gNeedle)" stroke-width="12" fill="none" stroke-linecap="round" />
          <line x1="100" y1="100" :x2="needle.x" :y2="needle.y" stroke="#fff" stroke-width="3" stroke-linecap="round" />
          <circle cx="100" cy="100" r="7" fill="#fff" />
          <text x="100" y="118" text-anchor="middle" class="g-val sm">{{ weekAhead }}</text>
        </svg>
        <div class="needle-foot"><span class="muted">meetings in the next 7 days</span></div>
      </div>

      <div class="gcard c-span4 table-card">
        <div class="thead"><span>Name</span><span>Client</span><span>When</span></div>
        <ul v-if="upcoming.length" class="trows">
          <li v-for="m in upcoming.slice(0, 5)" :key="m.id">
            <button @click="open('meetings', m)" class="trow">
              <span class="tname"><ClientChip :name="m.client_name || m.title" :id="m.client_id" size="sm" :hover="false" /><span class="truncate">{{ m.title }}</span></span>
              <span class="tclient truncate">{{ m.client_name || '—' }}</span>
              <span class="twhen">{{ fmtDate(m.date) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">No upcoming meetings.</p>
      </div>

      <div class="c-span2 mini-col">
        <div class="gcard mini">
          <div class="mini-head">Bars</div>
          <div class="mini-row"><b><CountUp :value="avgPerMonth" /></b><span class="delta" :class="meetingsDelta >= 0 ? 'up' : 'down'">{{ meetingsDelta >= 0 ? '+' : '' }}{{ meetingsDelta }}%</span></div>
          <div class="mini-sub muted">avg / month</div>
          <svg class="mini-bars" viewBox="0 0 140 34" preserveAspectRatio="none">
            <rect v-for="(c, i) in barsSeries" :key="i" :x="i * (140 / barsSeries.length) + 2" :y="34 - Math.max(3, (c / maxCandle) * 32)" :width="140 / barsSeries.length - 4" :height="Math.max(3, (c / maxCandle) * 32)" rx="2" fill="#35d3c6" :opacity="0.4 + 0.6 * (c / maxCandle)" />
          </svg>
        </div>
        <div class="gcard mini">
          <div class="mini-head">Linear</div>
          <div class="mini-row"><b><CountUp :value="totals.meetings" /></b><span class="delta up">total</span></div>
          <div class="mini-sub muted">all-time meetings</div>
          <svg class="mini-line" viewBox="0 0 140 34" preserveAspectRatio="none">
            <polyline :points="meetingWeeks.map((v, i) => `${i * (140 / (meetingWeeks.length - 1))},${34 - Math.max(2, (v / Math.max(1, ...meetingWeeks)) * 30)}`).join(' ')" fill="none" stroke="#e8763e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <polygon :points="`0,34 ${meetingWeeks.map((v, i) => `${i * (140 / (meetingWeeks.length - 1))},${34 - Math.max(2, (v / Math.max(1, ...meetingWeeks)) * 30)}`).join(' ')} 140,34`" fill="url(#gArea)" />
          </svg>
        </div>
      </div>
    </div>

    <button @click="goHome" title="Back to workspaces" class="dash-home"><House class="h-5 w-5" :stroke-width="1.9" /></button>
  </div>
</template>

<style scoped>
/* self-contained dark immersive canvas — breaks out of the padded main area */
/* the content sits in main's padding; the background layer extends out to the
   content-area edges (no negative margins on the flow element → no scroll jank) */
.dash { position: relative; min-height: calc(100dvh - 7rem); color: #f4f1ec; }
.dash-bg {
  position: absolute; inset: -1rem; z-index: 0; pointer-events: none; overflow: hidden;
  /* soft glow blooms scattered irregularly across the field, over the navy base */
  background:
    radial-gradient(38% 34% at 10% 6%,  rgba(232, 118, 62, 0.13), transparent 62%),
    radial-gradient(34% 32% at 82% 12%, rgba(72, 104, 146, 0.16), transparent 62%),
    radial-gradient(30% 30% at 57% 40%, rgba(232, 118, 62, 0.09), transparent 60%),
    radial-gradient(36% 34% at 26% 58%, rgba(66, 110, 132, 0.14), transparent 62%),
    radial-gradient(40% 36% at 92% 66%, rgba(232, 118, 62, 0.12), transparent 62%),
    radial-gradient(34% 34% at 47% 92%, rgba(70, 120, 140, 0.13), transparent 62%),
    radial-gradient(30% 30% at 6% 85%,  rgba(232, 118, 62, 0.10), transparent 60%),
    radial-gradient(30% 30% at 70% 88%, rgba(80, 100, 150, 0.12), transparent 62%),
    linear-gradient(160deg, #0c111a 0%, #090d15 55%, #070a11 100%);
}
@media (min-width: 640px) { .dash-bg { inset: -1.5rem; } }
@media (min-width: 1024px) { .dash-bg { inset: -2rem; } }
.dash-bg::before {
  content: ''; position: absolute; inset: 0; opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}
.dash > *:not(.dash-bg) { position: relative; z-index: 1; }

.dash-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
.dash-greet { font-family: 'IBM Plex Serif', Georgia, serif; font-size: 1.75rem; line-height: 1.1; color: #fff; }
.dash-date { font-size: 0.82rem; color: #97a0b0; margin-top: 0.35rem; }
.dash-cta {
  display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; white-space: nowrap;
  padding: 0.55rem 1.1rem; border-radius: 0.7rem; font-size: 0.85rem; font-weight: 600; color: #fff;
  background: linear-gradient(180deg, #ef8747, #e2662c); box-shadow: 0 8px 24px rgba(226, 102, 44, 0.35);
  transition: transform .15s, box-shadow .15s;
}
.dash-cta:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(226, 102, 44, 0.45); }

.bento { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem; align-items: stretch; }
.c-span4 { grid-column: span 12; } .c-span8 { grid-column: span 12; }
.c-span3 { grid-column: span 12; } .c-span2 { grid-column: span 12; }
@media (min-width: 700px) { .c-span4 { grid-column: span 6; } .c-span3 { grid-column: span 6; } .c-span2 { grid-column: span 6; } }
@media (min-width: 1024px) {
  .c-span8 { grid-column: span 8; } .c-span4 { grid-column: span 4; }
  .c-span3 { grid-column: span 3; } .c-span2 { grid-column: span 2; }
}

.gcard {
  background: rgba(16, 20, 28, 0.62); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 1.1rem; padding: 1.1rem 1.2rem;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); display: flex; flex-direction: column;
}
.muted { color: #6b7484; }
.link { font-size: 0.72rem; color: #97a0b0; } .link:hover { color: #fff; }
.chip { display: inline-grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 999px; font-size: 0.72rem; }
.chip-orange { background: rgba(232, 118, 62, 0.16); color: #ef8747; }
.chip-teal { background: rgba(53, 211, 198, 0.16); color: #35d3c6; }
.delta { display: inline-flex; align-items: center; gap: 0.15rem; font-size: 0.72rem; font-weight: 600; padding: 0.12rem 0.45rem; border-radius: 999px; white-space: nowrap; }
.delta.up { color: #34d399; background: rgba(52, 211, 153, 0.12); }
.delta.down { color: #f0774a; background: rgba(240, 119, 74, 0.12); }

/* stat cards */
.stat-head { display: flex; align-items: center; gap: 0.55rem; font-size: 0.85rem; color: #c7cdd8; }
.stat-head.between, .between { justify-content: space-between; }
.stat-head.between > span { display: inline-flex; align-items: center; gap: 0.55rem; }
.stat-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin: 0.7rem 0 0.6rem; }
.stat-num { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; color: #fff; font-variant-numeric: tabular-nums; }
.spark-bars { width: 100%; height: 40px; margin-top: auto; }

/* gauges */
.gauge-card { align-items: center; }
.gauge-card .stat-head { align-self: stretch; }
.gauge-arc { width: 100%; max-width: 220px; margin: 0.4rem auto 0; }
.g-val { fill: #fff; font-size: 26px; font-weight: 700; } .g-val.sm { font-size: 22px; }
.g-sub { fill: #6b7484; font-size: 11px; }
.gauge-foot { font-size: 0.75rem; font-weight: 600; margin-top: 0.2rem; }
.gauge-foot.up { color: #34d399; } .gauge-foot.down { color: #f0774a; }
.needle-svg { width: 100%; max-width: 200px; margin: 0.5rem auto 0; }
.needle-foot { text-align: center; font-size: 0.72rem; margin-top: 0.2rem; }

/* big chart */
.chart-card { gap: 0.2rem; }
.chart-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.chart-title { font-size: 0.95rem; color: #e7eaf0; font-weight: 600; }
.chart-price { font-size: 1.5rem; font-weight: 700; color: #fff; margin-top: 0.15rem; }
.range { display: flex; gap: 0.25rem; background: rgba(255, 255, 255, 0.04); padding: 0.2rem; border-radius: 0.6rem; }
.range-b { padding: 0.28rem 0.6rem; border-radius: 0.45rem; font-size: 0.75rem; font-weight: 600; color: #97a0b0; transition: all .15s; }
.range-b.on { background: linear-gradient(180deg, #ef8747, #e2662c); color: #fff; }
.chart-stats { display: flex; gap: 1.5rem; margin: 0.6rem 0 0.4rem; }
.cstat { display: flex; flex-direction: column; gap: 0.1rem; font-size: 0.72rem; }
.cstat b { font-size: 0.95rem; color: #fff; font-weight: 700; }
.chart-svg { width: 100%; height: 240px; }
.chart-axis { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.65rem; color: #5a6473; }
.chart-axis .cur { color: #ef8747; font-weight: 700; }

/* coming up */
.up-card { gap: 0.7rem; }
.up-list { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
.up-row { display: flex; align-items: center; gap: 0.6rem; width: 100%; text-align: left; padding: 0.45rem 0.4rem; border-radius: 0.6rem; transition: background .15s; }
.up-row:hover { background: rgba(255, 255, 255, 0.04); }
.up-dot { width: 0.5rem; height: 0.5rem; border-radius: 999px; flex-shrink: 0; background: #ef8747; }
.up-main { display: flex; flex-direction: column; min-width: 0; }
.up-title { font-size: 0.85rem; color: #eef0f4; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-meta { font-size: 0.72rem; color: #6b7484; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-cta { display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: auto; padding: 0.7rem; border-radius: 0.7rem; font-size: 0.85rem; font-weight: 600; color: #fff; background: linear-gradient(180deg, #ef8747, #e2662c); box-shadow: 0 8px 22px rgba(226, 102, 44, 0.3); transition: transform .15s; }
.up-cta:hover { transform: translateY(-1px); }
.empty { font-size: 0.82rem; color: #6b7484; flex: 1; }

/* at a glance */
.glance-big { font-size: 1.6rem; font-weight: 700; color: #fff; margin: 0.6rem 0 0.5rem; }
.glance-list { display: flex; flex-direction: column; gap: 0.1rem; }
.glance-row { display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.3rem; border-radius: 0.5rem; transition: background .15s; }
.glance-row:hover { background: rgba(255, 255, 255, 0.04); }
.glance-label { flex: 1; font-size: 0.82rem; color: #c7cdd8; }
.glance-val { font-size: 0.9rem; color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }

/* table */
.table-card { gap: 0.2rem; }
.thead, .trow { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 0.5rem; align-items: center; }
.thead { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #5a6473; padding: 0 0.4rem 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.trows { display: flex; flex-direction: column; }
.trow { width: 100%; text-align: left; padding: 0.5rem 0.4rem; border-radius: 0.5rem; transition: background .15s; }
.trow:hover { background: rgba(255, 255, 255, 0.04); }
.tname { display: flex; align-items: center; gap: 0.5rem; min-width: 0; font-size: 0.82rem; color: #eef0f4; }
.tclient { font-size: 0.78rem; color: #97a0b0; }
.twhen { font-size: 0.75rem; color: #6b7484; text-align: right; white-space: nowrap; }

/* mini stacked charts */
.mini-col { display: flex; flex-direction: column; gap: 1rem; }
.mini { flex: 1; padding: 0.9rem 1rem; gap: 0.1rem; }
.mini-head { font-size: 0.8rem; color: #c7cdd8; font-weight: 600; }
.mini-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.4rem; margin-top: 0.15rem; }
.mini-row b { font-size: 1.25rem; color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
.mini-sub { font-size: 0.68rem; }
.mini-bars, .mini-line { width: 100%; height: 34px; margin-top: 0.45rem; }

.dash-home {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 40; height: 2.75rem; width: 2.75rem; border-radius: 999px;
  display: grid; place-items: center; color: #97a0b0;
  background: rgba(16, 20, 28, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4); transition: all .15s;
}
.dash-home:hover { color: #ef8747; border-color: rgba(239, 135, 71, 0.4); transform: translateY(-2px); }

@media (prefers-reduced-motion: reduce) { .dash-cta, .up-cta, .dash-home { transition: none; } }
</style>
