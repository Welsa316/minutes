<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { invoices as api } from '../api/endpoints.js';
import ClientChip from '../components/ClientChip.vue';
import StatusBadge from '../components/StatusBadge.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { money, withTax } from '../utils/money.js';
import { useToastStore } from '../stores/toast.js';

const router = useRouter();
const toast = useToastStore();

const items = ref([]);
const loading = ref(true);
const filter = ref('all');
const creating = ref(false);

// --- paste-to-import: drop in an invoice drafted elsewhere (e.g. a Claude chat) ---
const pasteOpen = ref(false);
const pasteText = ref('');
const importing = ref(false);

// Pull the JSON object out of whatever was pasted — a bare object, or one wrapped
// in a ```minutes-invoice / ```json fence, or sitting inside surrounding prose.
function extractInvoice(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('empty');
  const fence = t.match(/```(?:[a-zA-Z-]+)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  if (t[0] !== '{') {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s !== -1 && e > s) t = t.slice(s, e + 1);
  }
  return JSON.parse(t);
}

async function doImport() {
  let payload;
  try {
    payload = extractInvoice(pasteText.value);
  } catch {
    toast.error('Couldn’t read that — paste the invoice block (the JSON).');
    return;
  }
  importing.value = true;
  try {
    const inv = await api.importOne(payload);
    pasteOpen.value = false;
    pasteText.value = '';
    toast.success(`Imported ${inv.number || 'invoice'}`);
    router.push(`/invoices/${inv.id}`);
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Couldn’t import that invoice.');
  } finally {
    importing.value = false;
  }
}

const FILTERS = ['all', 'outstanding', 'paid'];

function total(inv) { return withTax(inv.subtotal_cents, inv.tax_pct); }
function displayStatus(inv) { return inv.overdue ? 'overdue' : inv.status; }

const visible = computed(() => {
  if (filter.value === 'paid') return items.value.filter((i) => i.status === 'paid');
  if (filter.value === 'outstanding') return items.value.filter((i) => i.status !== 'paid');
  return items.value;
});
const outstanding = computed(() =>
  items.value.filter((i) => i.status !== 'paid').reduce((s, i) => s + total(i), 0),
);

async function load() {
  loading.value = true;
  items.value = await api.list();
  loading.value = false;
}

async function create() {
  creating.value = true;
  try {
    const inv = await api.create({});
    router.push(`/invoices/${inv.id}`);
  } finally { creating.value = false; }
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <header class="flex items-baseline justify-between gap-4">
      <h1 class="text-3xl font-serif text-ink">Invoices</h1>
      <div class="flex items-center gap-4">
        <span v-if="outstanding > 0" class="text-sm text-slate-warm">
          Outstanding: <span class="text-ink font-medium tabular-nums">{{ money(outstanding) }}</span>
        </span>
        <button @click="pasteOpen = true" class="text-sm px-3 py-1.5 rounded-lg border border-sand text-slate-warm hover:text-ink hover:border-terracotta/40 transition-colors">Paste invoice</button>
        <button @click="create" :disabled="creating" class="btn-primary text-sm">New invoice</button>
      </div>
    </header>

    <Teleport to="body">
      <div v-if="pasteOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="pasteOpen = false" />
        <div class="relative bg-surface border border-sand rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3">
          <h2 class="text-lg font-serif text-ink">Paste an invoice</h2>
          <p class="text-xs text-slate-warm leading-relaxed">
            Paste the invoice block from your Claude chat. The client (matched or created), line items and totals
            come in automatically — no retyping.
          </p>
          <textarea
            v-model="pasteText"
            rows="9"
            spellcheck="false"
            placeholder='{
  "client": "Acme Co",
  "due_date": "2026-08-01",
  "line_items": [
    { "label": "Website work", "qty": 1, "unit": 1500 }
  ]
}'
            class="input w-full font-mono text-xs leading-relaxed"
            @keydown.meta.enter="doImport"
            @keydown.ctrl.enter="doImport"
          />
          <div class="flex items-center justify-end gap-2">
            <button @click="pasteOpen = false" class="text-sm px-3 py-1.5 text-slate-warm hover:text-ink">Cancel</button>
            <button @click="doImport" :disabled="importing || !pasteText.trim()" class="btn-primary text-sm">
              {{ importing ? 'Importing…' : 'Import' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="flex items-center gap-1 text-sm border-b border-sand/70 pb-2">
      <button
        v-for="f in FILTERS"
        :key="f"
        @click="filter = f"
        :class="['px-2.5 py-1 rounded capitalize', filter === f ? 'bg-sand text-ink' : 'text-slate-warm hover:text-ink']"
      >{{ f }}</button>
    </div>

    <Skeleton v-if="loading" :rows="4" />

    <ul v-else-if="visible.length" class="border border-sand rounded-lg overflow-hidden bg-surface stagger">
      <li
        v-for="(inv, idx) in visible"
        :key="inv.id"
        @click="router.push(`/invoices/${inv.id}`)"
        :class="['flex items-center gap-4 px-4 py-3 hover:bg-sand/40 cursor-pointer', idx > 0 && 'border-t border-sand/60']"
      >
        <span class="font-medium text-ink tabular-nums w-20 shrink-0">{{ inv.number || '—' }}</span>
        <div class="flex-1 min-w-0">
          <ClientChip v-if="inv.client_name" :name="inv.client_name" :id="inv.client_id" size="sm" :hover="false" />
          <span v-else class="text-sm text-slate-warm">No client</span>
          <div class="text-xs text-slate-warm mt-0.5">
            Issued {{ fmtDate(inv.issue_date) }}<template v-if="inv.due_date"> · due {{ fmtDate(inv.due_date) }}</template>
          </div>
        </div>
        <span class="text-sm text-ink tabular-nums shrink-0">{{ money(total(inv)) }}</span>
        <StatusBadge :status="displayStatus(inv)" variant="invoice" class="shrink-0" />
      </li>
    </ul>

    <EmptyState
      v-else
      icon="$"
      title="No invoices yet"
      hint="Create an invoice, pull in unbilled hours, and get paid."
    />
  </div>
</template>
