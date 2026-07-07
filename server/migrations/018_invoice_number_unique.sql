-- Belt-and-suspenders for invoice numbers: a duplicate can never persist even if
-- two concurrent creates race the MAX+1 read (the route retries on the violation).
-- Partial on live rows so a soft-deleted invoice doesn't block reissuing its number.
CREATE UNIQUE INDEX idx_invoices_ws_number ON invoices (workspace_id, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;
