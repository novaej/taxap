-- Row-Level Security (RLS) policies.
-- ADR-004: all queries on taxpayer-owned data must filter by app.current_user_id.
--
-- Two things a previous version of this migration got wrong, both silent
-- failures (see CLAUDE.md -> "Errores fáciles de cometer aquí"):
--   1. Policies referenced snake_case columns that didn't exist (the schema
--      had no @map, columns were camelCase). Now the schema itself maps to
--      snake_case, so policies use the real column names directly.
--   2. ENABLE ROW LEVEL SECURITY alone is not enough when the app connects
--      as the same role that owns the tables (true here: `taxap` runs the
--      migrations and serves the app). Postgres exempts a table's owner from
--      its own policies unless FORCE ROW LEVEL SECURITY is also set.
-- Both are applied from the start this time.
--
-- ADR-004's own example bypasses these policies whenever app.current_user_id
-- is simply *unset*. Implemented literally, that makes a deliberate admin
-- call indistinguishable from a query someone forgot to wrap in withUser() —
-- exactly the failure mode this file exists to prevent (CLAUDE.md regla
-- dura #2). Fixed here (see "Actualización" note in ADR-004): asAdmin() must
-- set an explicit sentinel value, not merely RESET the variable. An unset
-- variable now fails closed — sees nothing — instead of failing open.

CREATE FUNCTION get_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Reserved id no real user can ever have (users get uuidv7(), never all
-- zeros). asAdmin() must set app.current_user_id to exactly this value.
CREATE FUNCTION is_system_admin() RETURNS BOOLEAN AS $$
  SELECT get_current_user_id() = '00000000-0000-0000-0000-000000000000'::uuid;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- user_taxpayers
-- ============================================================================

ALTER TABLE user_taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_taxpayers FORCE ROW LEVEL SECURITY;

CREATE POLICY user_taxpayers_select ON user_taxpayers FOR SELECT
  USING (is_system_admin() OR user_id = get_current_user_id());

-- A user links themselves to a taxpayer they just created, in the same
-- transaction as the taxpayers INSERT below (ADR-003).
CREATE POLICY user_taxpayers_insert ON user_taxpayers FOR INSERT
  WITH CHECK (NOT is_system_admin() AND user_id = get_current_user_id());

-- ============================================================================
-- taxpayers
-- ============================================================================

ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers FORCE ROW LEVEL SECURITY;

-- created_by (not in data-model.md; added here) lets the creator see the row
-- an INSERT ... RETURNING returns before any user_taxpayers link exists —
-- Postgres filters RETURNING through the SELECT policy, and Prisma's
-- .create() always uses RETURNING. Without it, nobody could ever create a
-- taxpayer through Prisma at all. Ownership after creation still runs
-- through user_taxpayers, same as every other table here.
CREATE POLICY taxpayers_select ON taxpayers FOR SELECT
  USING (
    is_system_admin()
    OR created_by = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = taxpayers.id AND ut.user_id = get_current_user_id()
    )
  );

CREATE POLICY taxpayers_insert ON taxpayers FOR INSERT
  WITH CHECK (
    is_system_admin() OR created_by = get_current_user_id()
  );

CREATE POLICY taxpayers_update ON taxpayers FOR UPDATE
  USING (
    is_system_admin()
    OR created_by = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = taxpayers.id AND ut.user_id = get_current_user_id()
    )
  );

-- ============================================================================
-- Tablas hijas: mismo patrón, ownership vía taxpayer_id -> user_taxpayers
-- ============================================================================

ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods FORCE ROW LEVEL SECURITY;

CREATE POLICY tax_periods_all ON tax_periods FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = tax_periods.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files FORCE ROW LEVEL SECURITY;

CREATE POLICY source_files_all ON source_files FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = source_files.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

ALTER TABLE invoices_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_received FORCE ROW LEVEL SECURITY;

CREATE POLICY invoices_received_all ON invoices_received FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = invoices_received.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

ALTER TABLE invoices_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_issued FORCE ROW LEVEL SECURITY;

CREATE POLICY invoices_issued_all ON invoices_issued FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = invoices_issued.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

ALTER TABLE supplier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY supplier_rules_all ON supplier_rules FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = supplier_rules.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

ALTER TABLE period_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_results FORCE ROW LEVEL SECURITY;

CREATE POLICY period_results_all ON period_results FOR ALL
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM tax_periods tp
      JOIN user_taxpayers ut ON ut.taxpayer_id = tp.taxpayer_id
      WHERE tp.id = period_results.tax_period_id AND ut.user_id = get_current_user_id()
    )
  );

-- classification_events: append-only (see immutability trigger below), scoped
-- via its denormalized taxpayer_id (ADR-013).
ALTER TABLE classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_events FORCE ROW LEVEL SECURITY;

CREATE POLICY classification_events_select ON classification_events FOR SELECT
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = classification_events.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

CREATE POLICY classification_events_insert ON classification_events FOR INSERT
  WITH CHECK (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = classification_events.taxpayer_id AND ut.user_id = get_current_user_id()
    )
  );

-- ============================================================================
-- Inmutabilidad de la bitácora (ADR-013): UPDATE y DELETE rechazados por
-- trigger, no por política — así ninguna consulta administrativa, script de
-- mantenimiento o futuro proceso puede sortearlo.
-- ============================================================================

CREATE FUNCTION reject_classification_event_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'classification_events es append-only: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classification_events_no_update
  BEFORE UPDATE ON classification_events
  FOR EACH ROW EXECUTE FUNCTION reject_classification_event_mutation();

CREATE TRIGGER classification_events_no_delete
  BEFORE DELETE ON classification_events
  FOR EACH ROW EXECUTE FUNCTION reject_classification_event_mutation();
