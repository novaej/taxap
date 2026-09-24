-- Add Row-Level Security (RLS) policies
-- ADR-004: All queries to taxpayer data must filter by current user

-- Enable RLS on all taxpayer-owned tables
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_results ENABLE ROW LEVEL SECURITY;

-- Session variable function
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE SQL STABLE;

-- Policies for taxpayers
CREATE POLICY "users_can_see_their_taxpayers" ON taxpayers FOR SELECT
  USING (id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "no_direct_taxpayer_edits" ON taxpayers FOR UPDATE USING (FALSE);
CREATE POLICY "no_direct_taxpayer_deletes" ON taxpayers FOR DELETE USING (FALSE);

-- Policies for tax_periods
CREATE POLICY "users_can_see_their_periods" ON tax_periods FOR SELECT
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_edit_their_periods" ON tax_periods FOR UPDATE
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_their_periods" ON tax_periods FOR INSERT
  WITH CHECK (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));

-- Policies for source_files
CREATE POLICY "users_can_see_their_source_files" ON source_files FOR SELECT
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_source_files" ON source_files FOR INSERT
  WITH CHECK (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));

-- Policies for invoices_received
CREATE POLICY "users_can_see_received_invoices" ON invoices_received FOR SELECT
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_received_invoices" ON invoices_received FOR INSERT
  WITH CHECK (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_update_received_invoices" ON invoices_received FOR UPDATE
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));

-- Policies for invoices_issued
CREATE POLICY "users_can_see_issued_invoices" ON invoices_issued FOR SELECT
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_issued_invoices" ON invoices_issued FOR INSERT
  WITH CHECK (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_update_issued_invoices" ON invoices_issued FOR UPDATE
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));

-- Policies for supplier_rules
CREATE POLICY "users_can_see_supplier_rules" ON supplier_rules FOR SELECT
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_supplier_rules" ON supplier_rules FOR INSERT
  WITH CHECK (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));
CREATE POLICY "users_can_update_supplier_rules" ON supplier_rules FOR UPDATE
  USING (taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id()));

-- Policies for classification_events (immutable)
CREATE POLICY "users_can_see_classification_events" ON classification_events FOR SELECT
  USING (taxpayer_id IN (SELECT t.id FROM user_taxpayers ut JOIN taxpayers t ON ut.taxpayer_id = t.id WHERE ut.user_id = get_current_user_id()));
CREATE POLICY "users_can_insert_classification_events" ON classification_events FOR INSERT
  WITH CHECK (user_id = get_current_user_id() AND taxpayer_id IN (SELECT t.id FROM user_taxpayers ut JOIN taxpayers t ON ut.taxpayer_id = t.id WHERE ut.user_id = get_current_user_id()));
CREATE POLICY "no_event_updates" ON classification_events FOR UPDATE USING (FALSE);
CREATE POLICY "no_event_deletes" ON classification_events FOR DELETE USING (FALSE);

-- Policies for period_results
CREATE POLICY "users_can_see_period_results" ON period_results FOR SELECT
  USING (tax_period_id IN (SELECT id FROM tax_periods WHERE taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id())));
CREATE POLICY "users_can_insert_period_results" ON period_results FOR INSERT
  WITH CHECK (tax_period_id IN (SELECT id FROM tax_periods WHERE taxpayer_id IN (SELECT taxpayer_id FROM user_taxpayers WHERE user_id = get_current_user_id())));
