<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { invoices as api, clients as clientsApi } from '../api/endpoints.js';
import StatusBadge from '../components/StatusBadge.vue';
import { useToastStore } from '../stores/toast.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { money, withTax, lineCents } from '../utils/money.js';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const ws = useWorkspaceStore();

const inv = ref(null);
const clients = ref([]);
const loading = ref(true);

const lineAmount = (li) => lineCents(li.qty, li.unit_cents);
const subtotal = computed(() => (inv.value?.line_items || []).reduce((s, li) => s + lineAmount(li), 0));
const total = computed(() => withTax(subtotal.value, inv.value?.tax_pct));
const taxAmount = computed(() => total.value - subtotal.value);
const overdue = computed(() => {
  const i = inv.value;
  return i && i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date(new Date().toDateString());
});

async function load() {
  loading.value = true;
  const [i, c] = await Promise.all([api.get(route.params.id), clientsApi.list()]);
  inv.value = i;
  clients.value = c;
  loading.value = false;
}

// Persist an invoice-level field, keeping the (locally-authoritative) line items.
async function saveField(patch) {
  if (!inv.value) return;
  Object.assign(inv.value, patch);
  try {
    const updated = await api.update(inv.value.id, patch);
    // Merge back only what this call persisted (plus the client fields it derives),
    // so a concurrent edit to another field isn't clobbered by a stale snapshot.
    for (const k of Object.keys(patch)) inv.value[k] = updated[k];
    if ('client_id' in patch) {
      inv.value.client_name = updated.client_name;
      inv.value.client_company = updated.client_company;
      inv.value.client_email = updated.client_email;
    }
  } catch { toast.error('Save failed'); }
}

async function saveLine(line) {
  try {
    await api.updateLine(line.id, { label: line.label, qty: Number(line.qty) || 0, unit_cents: Math.round(Number(line.unit_cents) || 0) });
  } catch { toast.error('Save failed'); }
}
function setRate(line, val) {
  line.unit_cents = Math.round((parseFloat(val) || 0) * 100);
  saveLine(line);
}
async function addLine() {
  const li = await api.addLine(inv.value.id, { label: '', qty: 1, unit_cents: 0 });
  inv.value.line_items.push(li);
}
async function removeLine(line) {
  const idx = inv.value.line_items.indexOf(line);
  if (idx > -1) inv.value.line_items.splice(idx, 1);
  try { await api.removeLine(line.id); } catch { toast.error('Delete failed'); load(); }
}
async function pullTime() {
  const input = window.prompt('Hourly rate for these hours ($):', '100');
  if (input === null) return;
  const rate = Math.round((parseFloat(input) || 0) * 100);
  try {
    const updated = await api.fromTime(inv.value.id, rate);
    inv.value = updated;
    toast.success(updated.added ? `Added ${updated.added} line${updated.added === 1 ? '' : 's'} from time` : 'No unbilled time found');
  } catch { toast.error('Couldn’t pull time'); }
}
async function destroy() {
  const id = inv.value.id;
  await api.remove(id);
  toast.show('Invoice deleted', {
    kind: 'info', ttl: 6000,
    action: { label: 'Undo', run: async () => { await api.restore(id); toast.success('Restored'); } },
  });
  router.replace('/invoices');
}

function esc(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''; }

function buildHtml() {
  const i = inv.value;
  const rows = i.line_items.map((li) => `<tr>
    <td>${esc(li.label)}</td>
    <td class="r">${Number(li.qty)}</td>
    <td class="r">${money(li.unit_cents)}</td>
    <td class="r">${money(lineAmount(li))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(i.number || 'Invoice')}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F1B2D;max-width:720px;margin:40px auto;padding:0 24px;}
      h1{font-family:Georgia,serif;font-size:28px;margin:0;}
      .muted{color:#6b7280;font-size:13px;}
      .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;}
      .to{margin:24px 0;font-size:14px;}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;}
      th,td{padding:8px 6px;border-bottom:1px solid #e7e2d9;text-align:left;}
      th.r,td.r{text-align:right;}
      tfoot td{border:0;padding:4px 6px;}
      .tot{font-weight:700;font-size:16px;border-top:2px solid #0F1B2D;}
      .notes{margin-top:28px;font-size:13px;color:#374151;white-space:pre-wrap;}
      .pill{display:inline-block;padding:2px 8px;border-radius:4px;background:#f0ede6;font-size:12px;text-transform:uppercase;}
    </style></head><body>
    <div class="top">
      <div><h1>Invoice</h1><div class="muted">${esc(i.number || '')}</div></div>
      <div style="text-align:right"><div class="pill">${esc(i.status)}</div>
        <div class="muted" style="margin-top:8px">Issued ${fmtDate(i.issue_date)}</div>
        ${i.due_date ? `<div class="muted">Due ${fmtDate(i.due_date)}</div>` : ''}</div>
    </div>
    <div class="muted">From</div><div style="font-weight:600">${esc(ws.active?.name || 'Minutes')}</div>
    <div class="to"><div class="muted">Bill to</div>
      <div style="font-weight:600">${esc(i.client_name || '—')}</div>
      ${i.client_company ? `<div>${esc(i.client_company)}</div>` : ''}
      ${i.client_email ? `<div class="muted">${esc(i.client_email)}</div>` : ''}</div>
    <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" class="r muted">Subtotal</td><td class="r">${money(subtotal.value)}</td></tr>
        ${Number(i.tax_pct) ? `<tr><td colspan="3" class="r muted">Tax (${Number(i.tax_pct)}%)</td><td class="r">${money(taxAmount.value)}</td></tr>` : ''}
        <tr><td colspan="3" class="r tot">Total</td><td class="r tot">${money(total.value)}</td></tr>
      </tfoot></table>
    ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
  </body></html>`;
}
function printInvoice() {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(buildHtml()); doc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 1500);
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div v-if="loading" class="p-8 text-sm text-slate-warm">Loading…</div>
  <div v-else-if="inv" class="max-w-3xl space-y-5">
    <div class="flex items-center gap-3">
      <RouterLink to="/invoices" class="text-sm text-slate-warm hover:text-ink">← Invoices</RouterLink>
      <div class="flex-1" />
      <button @click="printInvoice" class="text-sm text-slate-warm hover:text-ink">Print / PDF</button>
      <button @click="destroy" class="text-sm text-slate-warm hover:text-terracotta">Delete</button>
    </div>

    <!-- header: number + status -->
    <div class="flex items-center gap-3 flex-wrap">
      <input
        v-model="inv.number"
        @change="saveField({ number: inv.number })"
        class="text-3xl font-serif text-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0 w-44"
        placeholder="INV-0001"
      />
      <StatusBadge :status="inv.status" variant="invoice" editable @change="saveField({ status: $event })" />
      <span v-if="overdue" class="text-xs text-red-600 font-medium">· overdue</span>
    </div>

    <!-- meta -->
    <div class="card grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label class="block">
        <span class="label">Client</span>
        <select :value="inv.client_id || ''" @change="saveField({ client_id: $event.target.value || null })" class="input">
          <option value="">No client</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="block">
        <span class="label">Tax %</span>
        <input :value="inv.tax_pct" @change="saveField({ tax_pct: Number($event.target.value) || 0 })" type="number" step="any" class="input" />
      </label>
      <label class="block">
        <span class="label">Issue date</span>
        <input :value="inv.issue_date ? inv.issue_date.slice(0,10) : ''" @change="saveField({ issue_date: $event.target.value || null })" type="date" class="input" />
      </label>
      <label class="block">
        <span class="label">Due date</span>
        <input :value="inv.due_date ? inv.due_date.slice(0,10) : ''" @change="saveField({ due_date: $event.target.value || null })" type="date" class="input" />
      </label>
    </div>

    <!-- line items -->
    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-serif text-lg text-ink">Line items</h2>
        <button @click="pullTime" class="text-xs text-slate-warm hover:text-terracotta">↧ Add unbilled hours</button>
      </div>
      <div v-if="inv.line_items.length" class="space-y-1.5">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-warm px-1">
          <span class="flex-1">Description</span>
          <span class="w-14 text-right">Qty</span>
          <span class="w-24 text-right">Rate</span>
          <span class="w-24 text-right">Amount</span>
          <span class="w-5" />
        </div>
        <div v-for="line in inv.line_items" :key="line.id" class="flex items-center gap-2 group">
          <input v-model="line.label" @change="saveLine(line)" placeholder="Description" class="flex-1 bg-transparent border border-sand rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40" />
          <input v-model.number="line.qty" @change="saveLine(line)" type="number" step="any" class="w-14 bg-transparent border border-sand rounded px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-terracotta/40" />
          <input :value="(line.unit_cents / 100)" @change="setRate(line, $event.target.value)" type="number" step="any" class="w-24 bg-transparent border border-sand rounded px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-terracotta/40" />
          <span class="w-24 text-right text-sm text-ink tabular-nums">{{ money(lineAmount(line)) }}</span>
          <button @click="removeLine(line)" class="w-5 text-slate-warm hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">✕</button>
        </div>
      </div>
      <p v-else class="text-sm text-slate-warm py-2">No line items yet.</p>
      <button @click="addLine" class="mt-2 text-sm text-slate-warm hover:text-terracotta">+ Add line</button>

      <!-- totals -->
      <div class="mt-4 pt-3 border-t border-sand ml-auto max-w-[16rem] space-y-1 text-sm">
        <div class="flex justify-between text-slate-warm"><span>Subtotal</span><span class="tabular-nums">{{ money(subtotal) }}</span></div>
        <div v-if="Number(inv.tax_pct)" class="flex justify-between text-slate-warm"><span>Tax ({{ Number(inv.tax_pct) }}%)</span><span class="tabular-nums">{{ money(taxAmount) }}</span></div>
        <div class="flex justify-between font-medium text-ink text-base pt-1 border-t border-sand"><span>Total</span><span class="tabular-nums">{{ money(total) }}</span></div>
      </div>
    </div>

    <!-- notes -->
    <div class="card">
      <span class="label">Notes</span>
      <textarea :value="inv.notes || ''" @change="saveField({ notes: $event.target.value || null })" rows="3" placeholder="Payment terms, thank-you note…" class="input resize-none" />
    </div>
  </div>
</template>
