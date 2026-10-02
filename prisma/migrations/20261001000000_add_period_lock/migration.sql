-- Bloqueo de período (ADR-013, segundo mecanismo). Un período FILED
-- (tax_periods.locked_at fijado) no admite más modificaciones a sus
-- comprobantes. Vive en Postgres, igual que la inmutabilidad de
-- classification_events, para que ninguna consulta administrativa, script
-- de mantenimiento o futuro proceso lo sortee.
--
-- Alcance: invoices_received e invoices_issued ("comprobantes" en el
-- vocabulario de data-model.md). supplier_rules queda fuera a propósito --
-- no es dato de un período, aplica hacia adelante (ADR-006).

CREATE FUNCTION reject_locked_period_invoice_mutation() RETURNS TRIGGER AS $$
DECLARE
  v_tax_period_id UUID := COALESCE(NEW.tax_period_id, OLD.tax_period_id);
  v_locked_at TIMESTAMP;
BEGIN
  SELECT locked_at INTO v_locked_at FROM tax_periods WHERE id = v_tax_period_id;

  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION
      'El período % está bloqueado desde %: % no permitido sobre sus comprobantes. Reabra el período explícitamente primero.',
      v_tax_period_id, v_locked_at, TG_OP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_received_locked_period
  BEFORE INSERT OR UPDATE OR DELETE ON invoices_received
  FOR EACH ROW EXECUTE FUNCTION reject_locked_period_invoice_mutation();

CREATE TRIGGER invoices_issued_locked_period
  BEFORE INSERT OR UPDATE OR DELETE ON invoices_issued
  FOR EACH ROW EXECUTE FUNCTION reject_locked_period_invoice_mutation();
