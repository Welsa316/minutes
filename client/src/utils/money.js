// Cents → a localized currency string. Invoicing stores integer cents to avoid
// float drift; formatting happens only at the edge.
export function money(cents, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(cents) || 0) / 100);
}

// One line's amount in cents: round(qty * unit_cents). Computed over exact decimal
// (not IEEE-754 floats) with half-away-from-zero rounding, so it matches Postgres
// `ROUND(qty::numeric * unit_cents)` exactly — the server list and this client view
// can never disagree by a cent.
export function lineCents(qty, unitCents) {
  const u = Math.round(Number(unitCents) || 0);
  const s = String(qty ?? '0').trim();
  const neg = s.startsWith('-');
  const [ip = '0', dp = ''] = s.replace('-', '').split('.');
  const scaledQty = parseInt((ip || '0') + dp, 10); // qty * 10^dp.length, as an integer
  if (!Number.isFinite(scaledQty)) return 0;
  const divisor = 10 ** dp.length;
  const product = Math.abs(scaledQty) * Math.abs(u); // |qty| * |unit| * 10^scale
  const rounded = Math.floor((product + divisor / 2) / divisor); // half away from zero
  return (neg !== u < 0 ? -1 : 1) * rounded;
}

// Subtotal (Σ line cents) → total with tax applied.
export function withTax(subtotalCents, taxPct) {
  return Math.round((Number(subtotalCents) || 0) * (1 + (Number(taxPct) || 0) / 100));
}
