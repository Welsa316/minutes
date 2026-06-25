<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { boards as api } from '../api/endpoints.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  parentType: { type: String, required: true }, // 'note' | 'meeting'
  parentId: { type: [Number, String], required: true },
  section: { type: String, default: '' },       // '' for notes; 'pre'|'during'|'after' for meeting phases
});

const toast = useToastStore();
const board = ref(null);
const loading = ref(true);
const drafts = reactive({});       // listId -> new-card text
const newListTitle = ref('');
const editing = ref(null);         // card copy being edited in the modal

const COLORS = [
  { name: 'None', hex: null },
  { name: 'Terracotta', hex: 'C65D3E' },
  { name: 'Sage', hex: '7C9082' },
  { name: 'Mustard', hex: 'C29A3A' },
  { name: 'Rust', hex: 'A2493A' },
  { name: 'Plum', hex: '7C4A6E' },
  { name: 'Forest', hex: '3F6B4C' },
  { name: 'Slate', hex: '4A5568' },
];

async function load() {
  loading.value = true;
  try { board.value = await api.get(props.parentType, props.parentId, props.section); }
  catch { board.value = null; }
  finally { loading.value = false; }
}
onMounted(load);
watch(() => [props.parentType, props.parentId, props.section], load);

function buildArrange() {
  return {
    listOrder: board.value.lists.map((l) => l.id),
    lists: board.value.lists.map((l) => ({ id: l.id, cardIds: l.cards.map((c) => c.id) })),
  };
}
// Persist after any drag. Skip if a card is still a temp (optimistic) id.
async function persist() {
  if (!board.value) return;
  const hasTemp = board.value.lists.some((l) => l.cards.some((c) => String(c.id).startsWith('tmp-')));
  if (hasTemp) return;
  try { await api.arrange(board.value.id, buildArrange()); }
  catch { toast.error('Failed to save'); load(); }
}

async function addCard(list) {
  const key = String(list.id);
  const title = (drafts[key] || '').trim();
  if (!title) return;
  drafts[key] = '';
  const tmp = { id: `tmp-${Date.now()}-${Math.round(Math.random() * 1e6)}`, list_id: list.id, title, body: null, color: null };
  list.cards.push(tmp);
  try {
    const real = await api.addCard(list.id, title);
    const i = list.cards.findIndex((c) => c.id === tmp.id);
    if (i >= 0) list.cards.splice(i, 1, real);
  } catch {
    const i = list.cards.findIndex((c) => c.id === tmp.id);
    if (i >= 0) list.cards.splice(i, 1);
    toast.error('Failed to add card');
  }
}

async function addList() {
  const title = newListTitle.value.trim() || 'New list';
  newListTitle.value = '';
  try {
    const list = await api.addList(board.value.id, title);
    board.value.lists.push(list);
  } catch { toast.error('Failed to add list'); }
}

async function renameList(list, value) {
  const t = value.trim();
  if (!t || t === list.title) return;
  list.title = t;
  try { await api.renameList(list.id, t); } catch { toast.error('Failed to rename'); }
}

async function removeList(list) {
  if (!confirm(`Delete list "${list.title}" and its cards?`)) return;
  const idx = board.value.lists.indexOf(list);
  if (idx >= 0) board.value.lists.splice(idx, 1);
  try { await api.removeList(list.id); } catch { toast.error('Failed'); load(); }
}

function openCard(card) { editing.value = { ...card }; }
function closeCard() { editing.value = null; }

async function saveCard() {
  const c = editing.value;
  try {
    const real = await api.updateCard(c.id, { title: c.title.trim() || 'Untitled', body: c.body || null, color: c.color || null });
    for (const l of board.value.lists) {
      const i = l.cards.findIndex((x) => x.id === c.id);
      if (i >= 0) l.cards.splice(i, 1, { ...l.cards[i], ...real });
    }
    editing.value = null;
  } catch { toast.error('Failed to save card'); }
}

async function deleteCard() {
  const c = editing.value;
  for (const l of board.value.lists) {
    const i = l.cards.findIndex((x) => x.id === c.id);
    if (i >= 0) l.cards.splice(i, 1);
  }
  editing.value = null;
  try { await api.removeCard(c.id); } catch { toast.error('Failed'); load(); }
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-sm text-slate-warm">Loading board…</div>

    <div v-else-if="board" class="flex gap-3 items-start overflow-x-auto pb-3">
      <VueDraggable
        v-model="board.lists"
        group="board-lists"
        handle=".list-handle"
        :animation="180"
        ghost-class="opacity-40"
        class="flex gap-3 items-start"
        @end="persist"
      >
        <div
          v-for="list in board.lists"
          :key="list.id"
          class="w-72 shrink-0 bg-sand/30 rounded-lg p-2 flex flex-col max-h-[68vh]"
        >
          <div class="list-handle flex items-center gap-2 px-1.5 py-1 cursor-grab active:cursor-grabbing">
            <input
              :value="list.title"
              @change="renameList(list, $event.target.value)"
              @keydown.enter.prevent="$event.target.blur()"
              class="flex-1 min-w-0 bg-transparent font-medium text-sm text-ink focus:outline-none focus:bg-warm rounded px-1"
            />
            <span class="text-xs text-slate-warm tabular-nums">{{ list.cards.length }}</span>
            <button @click="removeList(list)" class="text-slate-warm hover:text-terracotta text-sm px-1" title="Delete list">×</button>
          </div>

          <VueDraggable
            v-model="list.cards"
            group="board-cards"
            :animation="180"
            ghost-class="opacity-40"
            class="flex-1 overflow-y-auto space-y-2 min-h-[2rem] py-1"
            @end="persist"
          >
            <div
              v-for="card in list.cards"
              :key="card.id"
              @click="openCard(card)"
              class="bg-warm border border-sand rounded-md cursor-pointer hover:border-slate-warm/40 hover:shadow-sm transition-shadow overflow-hidden"
            >
              <div v-if="card.color" class="h-1.5" :style="{ background: '#' + card.color }" />
              <div class="px-2.5 py-2 text-sm text-ink whitespace-pre-wrap break-words">{{ card.title }}</div>
            </div>
          </VueDraggable>

          <form @submit.prevent="addCard(list)" class="px-0.5 pt-1">
            <input
              v-model="drafts[String(list.id)]"
              placeholder="+ Add a card"
              class="w-full bg-transparent text-sm px-2 py-1.5 rounded placeholder-slate-warm/60 focus:outline-none focus:bg-warm border border-transparent focus:border-sand transition-colors"
            />
          </form>
        </div>
      </VueDraggable>

      <!-- Add list -->
      <form @submit.prevent="addList" class="w-72 shrink-0">
        <input
          v-model="newListTitle"
          placeholder="+ Add list"
          class="w-full bg-sand/20 hover:bg-sand/30 text-sm px-3 py-2.5 rounded-lg placeholder-slate-warm/70 focus:outline-none focus:bg-warm border border-transparent focus:border-sand transition-colors"
        />
      </form>
    </div>

    <!-- Card editor modal -->
    <Teleport to="body">
      <Transition name="cm">
        <div v-if="editing" class="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4" @mousedown.self="closeCard">
          <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="closeCard" />
          <div class="relative w-full max-w-lg bg-surface border border-sand rounded-xl shadow-2xl overflow-hidden">
            <div v-if="editing.color" class="h-1.5" :style="{ background: '#' + editing.color }" />
            <div class="p-4 space-y-4">
              <textarea
                v-model="editing.title"
                rows="1"
                placeholder="Card title"
                class="w-full text-lg font-medium text-ink bg-transparent focus:outline-none resize-none"
              />
              <div>
                <label class="label">Notes</label>
                <textarea v-model="editing.body" rows="6" placeholder="Add more detail…" class="input resize-y" />
              </div>
              <div>
                <label class="label">Label</label>
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    v-for="c in COLORS"
                    :key="c.name"
                    type="button"
                    @click="editing.color = c.hex"
                    :title="c.name"
                    :class="['h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', editing.color === c.hex ? 'border-ink' : 'border-transparent']"
                    :style="{ background: c.hex ? '#' + c.hex : 'transparent', boxShadow: c.hex ? 'none' : 'inset 0 0 0 1px rgb(var(--c-sand))' }"
                  >
                    <span v-if="!c.hex" class="text-slate-warm text-xs">∅</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-t border-sand flex items-center justify-between">
              <button @click="deleteCard" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
              <div class="flex items-center gap-2">
                <button @click="closeCard" class="btn-ghost text-sm">Cancel</button>
                <button @click="saveCard" class="btn-primary text-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.cm-enter-active, .cm-leave-active { transition: opacity 180ms ease; }
.cm-enter-active > div.relative, .cm-leave-active > div.relative {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.cm-enter-from > div.relative { transform: translateY(-12px) scale(0.97); opacity: 0; }
.cm-leave-to > div.relative { transform: translateY(-6px) scale(0.99); opacity: 0; }
.cm-enter-from, .cm-leave-to { opacity: 0; }
</style>
