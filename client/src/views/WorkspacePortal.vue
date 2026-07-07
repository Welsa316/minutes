<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { pushWithoutTransition } from '../router/index.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { useSettingsStore } from '../stores/settings.js';
import WorkspaceCreate from '../components/WorkspaceCreate.vue';
import WorkspaceIcon from '../components/WorkspaceIcon.vue';

const auth = useAuthStore();
const ws = useWorkspaceStore();
const settings = useSettingsStore();

// Light/dark toggle — the portal has no sidebar, so it needs its own.
const systemDark = ref(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
const isDark = computed(() => settings.theme === 'dark' || (settings.theme === 'system' && systemDark.value));
function toggleTheme() { settings.theme = isDark.value ? 'light' : 'dark'; }

const reduce = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const showCreate = ref(false);
const diving = ref(false);
const diveColor = ref('#C65D3E');

const greeting = computed(() => {
  const h = new Date().getHours();
  const name = (auth.user?.name || auth.user?.email?.split('@')[0] || '').split(' ')[0];
  const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Late night';
  return name ? `${part}, ${name}` : part;
});

// --- Wordmark: type "Minutes" out on load (JS-driven so it's clearly visible) ---
const BRAND = 'Minutes';
const typed = ref('');
const typingDone = ref(false);
let typeTimer = 0;
function startTyping() {
  let i = 0;
  const tick = () => {
    i += 1;
    typed.value = BRAND.slice(0, i);
    if (i < BRAND.length) typeTimer = setTimeout(tick, 105);
    else typingDone.value = true;
  };
  typeTimer = setTimeout(tick, 350);
}

// --- Live clock + date ---
const now = ref(new Date());
let clockTimer = 0;
const timeStr = computed(() => now.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
const dateStr = computed(() => now.value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));

// --- Weather: coarse IP geolocation → Open-Meteo. No API key, cached 30 min, and
// entirely optional — if anything fails (offline, blocked) the chip just stays hidden. ---
const weather = ref(null);
const WEATHER_CACHE = 'minutes:weather';
const WX_ICON = { 0:'☀', 1:'🌤', 2:'⛅', 3:'☁', 45:'🌫', 48:'🌫', 51:'🌦', 53:'🌦', 55:'🌧', 56:'🌧', 57:'🌧', 61:'🌦', 63:'🌧', 65:'🌧', 66:'🌧', 67:'🌧', 71:'🌨', 73:'🌨', 75:'❄️', 77:'🌨', 80:'🌦', 81:'🌧', 82:'⛈', 85:'🌨', 86:'🌨', 95:'⛈', 96:'⛈', 99:'⛈' };

async function loadWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE) || 'null');
    if (cached && Date.now() - cached.ts < 30 * 60 * 1000) { weather.value = cached.data; return; }
  } catch { /* ignore bad cache */ }
  try {
    const geo = await fetch('https://ipapi.co/json/').then((r) => r.json());
    if (!geo?.latitude) return;
    const unit = geo.country_code === 'US' ? 'fahrenheit' : 'celsius';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,weather_code&temperature_unit=${unit}`;
    const wx = await fetch(url).then((r) => r.json());
    if (!wx?.current) return;
    const data = {
      temp: Math.round(wx.current.temperature_2m),
      unit: unit === 'fahrenheit' ? '°' : '°',
      icon: WX_ICON[wx.current.weather_code] || '·',
      city: geo.city || '',
    };
    weather.value = data;
    localStorage.setItem(WEATHER_CACHE, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* offline / blocked — leave weather hidden */ }
}

// --- The depth tunnel: concentric rings staggered evenly through Z ---
const RINGS = 7;
const DUR = 15;
function ringStyle(i) {
  return {
    '--i': i,
    '--sz': `${620 + (i % 3) * 70}px`,
    '--dur': `${DUR}s`,
    '--delay': `${-(i / RINGS) * DUR}s`,
    '--clr': `rgb(var(--c-terracotta) / ${i % 2 ? 0.85 : 0.55})`,
  };
}

// --- Parallax: tilt the tunnel toward the cursor. Written straight to the DOM
// inside a rAF so a fast mouse doesn't trigger a Vue re-render every move (that
// was the source of the stutter, especially in the Electron shell). ---
const depthEl = ref(null);
let px = 0, py = 0, raf = 0;
function applyTilt() {
  raf = 0;
  if (depthEl.value && !diving.value) depthEl.value.style.transform = `rotateX(${py}deg) rotateY(${px}deg)`;
}
function onMove(e) {
  py = (e.clientY / window.innerHeight - 0.5) * -7;
  px = (e.clientX / window.innerWidth - 0.5) * 7;
  if (!raf) raf = requestAnimationFrame(applyTilt);
}

onMounted(() => {
  if (!reduce) window.addEventListener('pointermove', onMove, { passive: true });
  startTyping(); // the wordmark types regardless of reduce-motion (subtle, non-vestibular)
  clockTimer = setInterval(() => { now.value = new Date(); }, 20000);
  loadWeather();
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove);
  if (raf) cancelAnimationFrame(raf);
  clearInterval(clockTimer);
  clearTimeout(typeTimer);
});

const MODULE_LABEL = { notes: 'Notes', meetings: 'Meetings', clients: 'Clients', projects: 'Projects', tags: 'Tags' };
function metaFor(w) {
  const s = (w.sections || []).map((k) => MODULE_LABEL[k]).filter(Boolean);
  return s.length ? s.slice(0, 4).join(' · ') : 'Empty';
}
function accent(w) { return w.color ? `#${w.color}` : '#0F1B2D'; }

// --- Dive into a workspace: set it active, rush the tunnel forward, then land ---
function enter(w) {
  if (diving.value) return; // guard against a second click mid-dive
  ws.setActive(w.id);
  // Bypass the router's View Transitions cross-fade — the dive IS the transition.
  if (reduce) { pushWithoutTransition('/'); return; }
  diveColor.value = accent(w);
  if (depthEl.value) depthEl.value.style.transform = ''; // hand the transform back to the CSS dive
  diving.value = true;
  setTimeout(() => pushWithoutTransition('/'), 460);
}

async function onLogout() {
  await auth.logout();
  window.location.assign('/login');
}
</script>

<template>
  <div class="portal" :class="{ diving, reduce }" :style="{ '--dive': diveColor }">
    <div class="depth" aria-hidden="true" ref="depthEl">
      <span v-for="i in RINGS" :key="i" class="ring" :style="ringStyle(i)" />
    </div>
    <div class="flash" aria-hidden="true" />

    <div class="content">
      <header class="topbar">
        <div class="wordmark" aria-label="Minutes">
          <span class="txt">{{ typed }}</span><span class="caret" :class="{ gone: typingDone }" aria-hidden="true" />
        </div>
        <div class="status">
          <span v-if="weather" class="chip wx" :title="weather.city">{{ weather.icon }} {{ weather.temp }}{{ weather.unit }}</span>
          <span class="chip clock">{{ timeStr }}</span>
          <span class="sep">·</span>
          <span class="chip date">{{ dateStr }}</span>
          <button class="theme" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">
              <template v-if="isDark"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></template>
              <path v-else d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
          <button class="signout" @click="onLogout">Sign out</button>
        </div>
      </header>

      <main class="hub">
        <h1 class="greet">{{ greeting }}</h1>
        <p class="label">Workspaces</p>

        <div class="grid">
          <button
            v-for="w in ws.list"
            :key="w.id"
            class="card"
            :style="{ '--accent': accent(w) }"
            @click="enter(w)"
          >
            <span class="ic"><WorkspaceIcon :icon="w.icon || w.name?.[0]" /></span>
            <span class="nm">{{ w.name }}</span>
            <span class="meta">{{ metaFor(w) }}</span>
          </button>

          <button class="card new" @click="showCreate = true">
            <span class="ic plus">+</span>
            <span class="nm">New workspace</span>
            <span class="meta">Pick your modules</span>
          </button>
        </div>
      </main>
    </div>

    <WorkspaceCreate v-if="showCreate" @close="showCreate = false" />
  </div>
</template>

<style scoped>
.portal {
  position: fixed; inset: 0; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 8%, rgb(var(--c-surface)) 0%, rgb(var(--c-warm)) 55%);
  color: rgb(var(--c-ink));
  perspective: 1000px; perspective-origin: 50% 42%;
  font-family: Inter, system-ui, sans-serif;
}

/* --- depth tunnel --- */
.depth {
  position: absolute; inset: 0; transform-style: preserve-3d;
  transition: transform .35s ease-out;
  z-index: 0;
}
.ring {
  position: absolute; top: 50%; left: 50%;
  width: var(--sz); height: var(--sz);
  margin-left: calc(var(--sz) / -2); margin-top: calc(var(--sz) / -2);
  border-radius: 50%; border: 2px solid var(--clr);
  animation: tunnel var(--dur) linear infinite; animation-delay: var(--delay);
  will-change: transform, opacity;
}
@keyframes tunnel {
  0%   { transform: translateZ(-1500px); opacity: 0; }
  14%  { opacity: .9; }
  80%  { opacity: .8; }
  100% { transform: translateZ(660px); opacity: 0; }
}

/* --- content --- */
.content {
  position: relative; z-index: 1;
  height: 100%; display: flex; flex-direction: column;
  padding: clamp(1.25rem, 3vw, 2.5rem);
  transition: opacity .45s ease-in, transform .45s ease-in;
}
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }

/* --- Wordmark: a clean serif that types itself out on load --- */
.wordmark {
  display: inline-flex; align-items: center;
  font-family: "IBM Plex Serif", Georgia, serif; font-weight: 600;
  font-size: 1.7rem; letter-spacing: 0.005em; line-height: 1; user-select: none;
  color: rgb(var(--c-terracotta)); min-width: 5.4em;
}
.wordmark .caret {
  width: 2px; height: 1.02em; margin-left: 3px; border-radius: 1px;
  background: rgb(var(--c-terracotta));
  animation: caretBlink 1s steps(1) infinite;
}
.wordmark .caret.gone { animation: caretBlink 1s steps(1) 3, caretFade .4s ease 3s forwards; }
@keyframes caretBlink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
@keyframes caretFade { to { opacity: 0; } }

/* --- Time / date / weather cluster --- */
.status { display: inline-flex; align-items: center; gap: 0.55rem; font-size: 0.85rem; color: rgb(var(--c-slate-warm)); }
.status .chip { white-space: nowrap; }
.status .clock { font-variant-numeric: tabular-nums; color: rgb(var(--c-ink)); font-weight: 500; }
.status .wx { color: rgb(var(--c-ink)); }
.status .sep { opacity: 0.5; }
.theme {
  display: grid; place-items: center; background: none; border: 0; cursor: pointer;
  color: rgb(var(--c-slate-warm)); padding: .35rem; border-radius: 8px;
  transition: color .2s, background .2s;
}
.theme:hover { color: rgb(var(--c-terracotta)); background: rgb(var(--c-ink) / 0.06); }
.signout {
  background: none; border: 0; cursor: pointer; color: rgb(var(--c-slate-warm)); font-size: .85rem;
  padding: .4rem .6rem; margin-left: .2rem; border-radius: 6px; transition: color .2s, background .2s;
}
.signout:hover { color: rgb(var(--c-ink)); background: rgb(var(--c-ink) / 0.06); }

@media (max-width: 560px) {
  .status .date, .status .sep { display: none; }
  .wordmark { font-size: 1.55rem; }
}

.hub { flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 940px; margin: 0 auto; width: 100%; }
.greet {
  font-family: "IBM Plex Serif", Georgia, serif; font-weight: 500;
  font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1; letter-spacing: -.02em; margin: 0 0 1.8rem;
}
.label { text-transform: uppercase; letter-spacing: .2em; font-size: .72rem; color: rgb(var(--c-slate-warm)); margin: 0 0 1rem; font-weight: 500; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1rem; }
.card {
  text-align: left; cursor: pointer; background: rgb(var(--c-surface) / 0.72);
  border: 1px solid rgb(var(--c-sand)); border-radius: 14px; padding: 1.15rem 1.2rem;
  display: flex; flex-direction: column; gap: .55rem; backdrop-filter: blur(6px);
  transition: transform .22s cubic-bezier(.2,.8,.2,1), border-color .22s, box-shadow .22s, background .22s;
}
.card:hover {
  transform: translateY(-3px); border-color: var(--accent, rgb(var(--c-terracotta)));
  box-shadow: 0 18px 40px rgba(0,0,0,.22); background: rgb(var(--c-surface) / 0.95);
}
.ic {
  width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
  background: var(--accent, rgb(var(--c-ink))); color: #FBF8F3; font-family: "IBM Plex Serif", Georgia, serif; font-size: 1.15rem;
}
.nm { font-family: "IBM Plex Serif", Georgia, serif; font-size: 1.2rem; color: rgb(var(--c-ink)); line-height: 1.1; }
.meta { font-size: .78rem; color: rgb(var(--c-slate-warm)); }

.card.new { border-style: dashed; background: transparent; }
.card.new .ic { background: transparent; color: rgb(var(--c-terracotta)); border: 1.5px dashed rgb(var(--c-terracotta) / 0.5); font-size: 1.4rem; }
.card.new:hover { border-color: rgb(var(--c-terracotta)); }

/* --- flash + dive --- */
.flash {
  position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0;
  background: radial-gradient(circle at 50% 42%, var(--dive), transparent 72%);
  transition: opacity .46s ease-in;
}
/* A warm bloom, not a solid wall — so the cut to the dashboard reads as arrival. */
.portal.diving .flash { opacity: .6; }
.portal.diving .depth { transform: translateZ(700px) scale(1.4); opacity: 0; transition: transform .52s cubic-bezier(.7,0,.84,0), opacity .52s; }
/* Stop the ring keyframes during the dive so the GPU only handles the rush. */
.portal.diving .ring { animation-play-state: paused; }
.portal.diving .content { opacity: 0; transform: scale(1.04); transition: opacity .4s ease-in, transform .4s ease-in; }

/* --- reduced motion: a calm static nest of rings, no dive --- */
.portal.reduce .ring { animation: none; opacity: .3; transform: translateZ(calc(var(--i) * -170px)); }
.portal.reduce .depth { transition: none; }

@media (max-width: 560px) {
  .grid { grid-template-columns: 1fr 1fr; }
}
</style>
