-- Invoicing: the payoff of Time Tracking. A light, PDF-first invoice tied to a
-- client, with line items that can be typed or pulled from unbilled billable time.
-- Totals are computed from the line items (subtotal = Σ round(qty*unit_cents)),
-- so there's nothing to keep in sync. "overdue" is derived on read (sent + past
-- due) rather than stored, so no cron is needed.

CREATE TABLE invoices (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  number       TEXT,
  issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  tax_pct      NUMERIC NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_invoices_workspace ON invoices(workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE invoice_line_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  qty         NUMERIC NOT NULL DEFAULT 1,
  unit_cents  INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

-- Link a time entry to the invoice it was billed on, so it can't be billed twice.
ALTER TABLE time_entries ADD COLUMN invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;

-- Enable Invoices on the Freelance workspace by default.
UPDATE workspaces
SET sections = (
  SELECT jsonb_agg(DISTINCT val)
  FROM jsonb_array_elements(COALESCE(sections, '[]'::jsonb) || '["invoices"]'::jsonb) AS val
)
WHERE slug = 'freelance';
