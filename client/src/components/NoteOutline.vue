<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';

// Auto-built table of contents for a TiptapEditor. Jump to any section, fold it
// from here, collapse/expand everything, or focus one section (fold the rest).
const props = defineProps({ editor: { type: Object, default: null } });

const headings = ref([]);
const activePos = ref(null);
const openMobile = ref(false);

let scrollEl = null;
let raf = 0;

function rebuild() {
  const ed = props.editor;
  if (!ed) { headings.value = []; return; }
  const out = [];
  ed.state.doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      out.push({
        pos: offset,
        level: node.attrs.level,
        collapsed: !!node.attrs.collapsed,
        text: (node.textContent || '').trim() || 'Untitled',
      });
    }
  });
  headings.value = out;
}

const hasHeadings = computed(() => headings.value.length > 0);
const allCollapsed = computed(() => hasHeadings.value && headings.value.every((h) => h.collapsed));

function jump(h) {
  const ed = props.editor;
  if (!ed) return;
  const dom = ed.view.nodeDOM(h.pos);
  if (dom?.scrollIntoView) dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
  activePos.value = h.pos;
  openMobile.value = false;
}

function toggleFold(h) {
  const ed = props.editor;
  if (!ed) return;
  const node = ed.state.doc.nodeAt(h.pos);
  if (!node) return;
  ed.view.dispatch(ed.state.tr.setNodeMarkup(h.pos, undefined, { ...node.attrs, collapsed: !node.attrs.collapsed }));
}

function setAll(collapsed) {
  const ed = props.editor;
  if (!ed) return;
  let tr = ed.state.tr;
  let changed = false;
  ed.state.doc.forEach((node, offset) => {
    if (node.type.name === 'heading' && !!node.attrs.collapsed !== collapsed) {
      tr = tr.setNodeMarkup(offset, undefined, { ...node.attrs, collapsed });
      changed = true;
    }
  });
  if (changed) ed.view.dispatch(tr);
}

// Focus a section: collapse its peers (same or higher level), expand it, scroll to it.
function focus(h) {
  const ed = props.editor;
  if (!ed) return;
  let tr = ed.state.tr;
  let changed = false;
  ed.state.doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return;
    const collapsed = offset === h.pos ? false : (node.attrs.level <= h.level ? true : node.attrs.collapsed);
    if (!!node.attrs.collapsed !== collapsed) {
      tr = tr.setNodeMarkup(offset, undefined, { ...node.attrs, collapsed });
      changed = true;
    }
  });
  if (changed) ed.view.dispatch(tr);
  nextTick(() => jump(h));
}

function findScrollEl() {
  const ed = props.editor;
  let el = ed?.view?.dom?.parentElement || null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') return el;
    el = el.parentElement;
  }
  return null; // scrolls with the window
}

function onScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const ed = props.editor;
    if (!ed) return;
    const refTop = scrollEl ? scrollEl.getBoundingClientRect().top : 0;
    let active = headings.value[0]?.pos ?? null;
    for (const h of headings.value) {
      const dom = ed.view.nodeDOM(h.pos);
      if (dom && dom.getBoundingClientRect().top - refTop <= 16) active = h.pos;
    }
    activePos.value = active;
  });
}

function attach() {
  detach();
  const ed = props.editor;
  if (!ed) return;
  ed.on('update', rebuild);
  ed.on('selectionUpdate', onScroll);
  rebuild();
  nextTick(() => {
    scrollEl = findScrollEl();
    (scrollEl || window).addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
}

function detach() {
  const ed = props.editor;
  if (ed) { ed.off?.('update', rebuild); ed.off?.('selectionUpdate', onScroll); }
  (scrollEl || window).removeEventListener('scroll', onScroll);
  scrollEl = null;
}

watch(() => props.editor, attach, { immediate: true });
onBeforeUnmount(detach);
</script>

<template>
  <div v-if="hasHeadings" class="text-sm select-none">
    <!-- Desktop rail -->
    <div class="hidden lg:block lg:max-h-[75vh] lg:overflow-y-auto pr-1">
      <div class="flex items-center justify-between px-1 mb-1.5">
        <span class="text-[10px] uppercase tracking-wider text-slate-warm">Outline</span>
        <button @click="setAll(!allCollapsed)" class="text-[11px] text-slate-warm hover:text-ink transition-colors">
          {{ allCollapsed ? 'Expand all' : 'Collapse all' }}
        </button>
      </div>
      <ul class="space-y-0.5">
        <li v-for="h in headings" :key="h.pos" class="group flex items-center gap-0.5">
          <button
            @click="toggleFold(h)"
            class="w-4 shrink-0 text-slate-warm/60 hover:text-ink text-[10px] leading-none"
            :title="h.collapsed ? 'Expand' : 'Collapse'"
          >{{ h.collapsed ? '▸' : '▾' }}</button>
          <button
            @click="jump(h)"
            :class="['flex-1 min-w-0 truncate text-left py-0.5 rounded hover:text-ink transition-colors',
                     activePos === h.pos ? 'text-terracotta font-medium' : 'text-slate-warm']"
            :style="{ paddingLeft: ((h.level - 1) * 0.7) + 'rem' }"
            :title="h.text"
          >{{ h.text }}</button>
          <button
            @click="focus(h)"
            class="opacity-0 group-hover:opacity-100 text-slate-warm/60 hover:text-terracotta text-xs shrink-0 px-0.5 transition-opacity"
            title="Focus — fold the other sections"
          >⊙</button>
        </li>
      </ul>
    </div>

    <!-- Mobile dropdown -->
    <div class="lg:hidden relative">
      <button
        @click="openMobile = !openMobile"
        class="w-full flex items-center justify-between px-3 py-1.5 rounded-md border border-sand bg-surface text-slate-warm"
      >
        <span>Outline · {{ headings.length }} section{{ headings.length === 1 ? '' : 's' }}</span>
        <span class="text-xs">{{ openMobile ? '▴' : '▾' }}</span>
      </button>
      <div v-if="openMobile" class="absolute left-0 right-0 mt-1 z-20 bg-surface border border-sand rounded-md shadow-lg p-1 max-h-[50vh] overflow-y-auto">
        <div class="flex justify-end px-1 pb-1">
          <button @click="setAll(!allCollapsed)" class="text-[11px] text-slate-warm hover:text-ink">
            {{ allCollapsed ? 'Expand all' : 'Collapse all' }}
          </button>
        </div>
        <button
          v-for="h in headings"
          :key="h.pos"
          @click="jump(h)"
          class="w-full truncate text-left px-2 py-1.5 rounded hover:bg-sand/50 text-slate-warm"
          :style="{ paddingLeft: (0.5 + (h.level - 1) * 0.7) + 'rem' }"
        >{{ h.text }}</button>
      </div>
    </div>
  </div>
</template>
