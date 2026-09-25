-- Add Row-Level Security (RLS) policies
-- ADR-004: All queries to taxpayer data must filter by current user
--
-- Column names are quoted camelCase ("taxpayerId", "userId", "taxPeriodId")
-- because Prisma has no @map on these fields: the actual Postgres columns
-- are camelCase, only the table names are snake_case (via @@map).

-- Enable RLS on all taxpayer-owned tables.
-- FORCE is required because the app connects as the same role that owns
-- these tables (it ran the migrations) — Postgres exempts table owners from
-- RLS policies unless FORCE ROW LEVEL SECURITY is also set. Without it, this
-- migration silently enables policies that never actually filter anything.
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods FORCE ROW LEVEL SECURITY;
ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_received FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_issued FORCE ROW LEVEL SECURITY;
ALTER TABLE supplier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_events FORCE ROW LEVEL SECURITY;
ALTER TABLE period_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_results FORCE ROW LEVEL SECURITY;

-- Session variable function
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE SQL STABLE;

-- Policies for taxpayers
CREATE POLICY "users_can_see_their_taxpayers" ON taxpayers FOR SELECT
  USING (id IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "no_direct_taxpayer_edits" ON taxpayers FOR UPDATE USING (FALSE);
CREATE POLICY "no_direct_taxpayer_deletes" ON taxpayers FOR DELETE USING (FALSE);

-- Policies for tax_periods
CREATE POLICY "users_can_see_their_periods" ON tax_periods FOR SELECT
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_edit_their_periods" ON tax_periods FOR UPDATE
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_their_periods" ON tax_periods FOR INSERT
  WITH CHECK ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));

-- Policies for source_files
CREATE POLICY "users_can_see_their_source_files" ON source_files FOR SELECT
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_source_files" ON source_files FOR INSERT
  WITH CHECK ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));

-- Policies for invoices_received
CREATE POLICY "users_can_see_received_invoices" ON invoices_received FOR SELECT
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_received_invoices" ON invoices_received FOR INSERT
  WITH CHECK ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_update_received_invoices" ON invoices_received FOR UPDATE
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));

-- Policies for invoices_issued
CREATE POLICY "users_can_see_issued_invoices" ON invoices_issued FOR SELECT
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_issued_invoices" ON invoices_issued FOR INSERT
  WITH CHECK ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_update_issued_invoices" ON invoices_issued FOR UPDATE
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));

-- Policies for supplier_rules
CREATE POLICY "users_can_see_supplier_rules" ON supplier_rules FOR SELECT
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_supplier_rules" ON supplier_rules FOR INSERT
  WITH CHECK ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));
CREATE POLICY "users_can_update_supplier_rules" ON supplier_rules FOR UPDATE
  USING ("taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id()));

-- Policies for classification_events (immutable)
CREATE POLICY "users_can_see_classification_events" ON classification_events FOR SELECT
  USING ("taxpayerId" IN (SELECT t.id FROM user_taxpayers ut JOIN taxpayers t ON ut."taxpayerId" = t.id WHERE ut."userId" = get_current_user_id()));
CREATE POLICY "users_can_insert_classification_events" ON classification_events FOR INSERT
  WITH CHECK ("userId" = get_current_user_id() AND "taxpayerId" IN (SELECT t.id FROM user_taxpayers ut JOIN taxpayers t ON ut."taxpayerId" = t.id WHERE ut."userId" = get_current_user_id()));
CREATE POLICY "no_event_updates" ON classification_events FOR UPDATE USING (FALSE);
CREATE POLICY "no_event_deletes" ON classification_events FOR DELETE USING (FALSE);

-- Policies for period_results
CREATE POLICY "users_can_see_period_results" ON period_results FOR SELECT
  USING ("taxPeriodId" IN (SELECT id FROM tax_periods WHERE "taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id())));
CREATE POLICY "users_can_insert_period_results" ON period_results FOR INSERT
  WITH CHECK ("taxPeriodId" IN (SELECT id FROM tax_periods WHERE "taxpayerId" IN (SELECT "taxpayerId" FROM user_taxpayers WHERE "userId" = get_current_user_id())));
