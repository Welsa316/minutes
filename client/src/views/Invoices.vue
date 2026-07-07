<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { invoices as api } from '../api/endpoints.js';
import ClientChip from '../components/ClientChip.vue';
import StatusBadge from '../components/StatusBadge.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';
import { money, withTax } from '../utils/money.js';

const router = useRouter();

const items = ref([]);
const loading = ref(true);
const filter = ref('all');
const creating = ref(false);

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
        <button @click="create" :disabled="creating" class="btn-primary text-sm">New invoice</button>
      </div>
    </header>

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
