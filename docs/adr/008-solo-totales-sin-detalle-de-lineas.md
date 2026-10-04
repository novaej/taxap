# ADR-008: Totals only, no line-item detail

> **Update (2026-09-20):** the rule "`IVA = 0` doesn't enter the cascade" is
> correct for **purchases**, where a voucher with no IVA generates no
> credit. **It doesn't automatically apply to sales**: the form splits
> sales with `IVA = 0` across destinations that do change the
> proportionality factor (exports, 0%-rate sales with credit
> entitlement…), and the issued-vouchers file doesn't indicate which one
> applies. That's why the user marks the destination of each `IVA = 0`
> sale in a table after upload. See
> [`docs/tax/formulario-104.md`](../tax/formulario-104.md) →
> *Decisions made*. The rest of the ADR is unchanged.

## Status
Accepted

## Date
2026-09-20

## Context

SRI voucher files carry **one total per voucher**, not line-item detail.
The columns useful for VAT are:

```
VALOR_SIN_IMPUESTOS    IVA    IMPORTE_TOTAL
```

This has an uncomfortable consequence: a **mixed** invoice — with taxed
items and 0%-rate items — arrives as a single pair of numbers.

```
VALOR_SIN_IMPUESTOS = 100.00
IVA                 =   4.50    → only 30.00 was taxed at 15%
```

Deriving the taxed base as `IVA / rate` and the rest as the 0% base was
considered. The arithmetic is trivial, but it introduces a number the
source doesn't contain, with its own rounding tolerances and its own
reconciliation failures.

What to do with `IVA = 0` was also considered. That case is ambiguous in
the source: it doesn't distinguish 0% rate, exempt, and not subject to
VAT.

## Decision

**Only what the file carries is stored, and nothing more.** `subtotal` and
`vat_amount` are faithful copies of `VALOR_SIN_IMPUESTOS` and `IVA`. There
are no derived columns.

**Classification operates on the whole voucher**, not on parts of it. A
mixed invoice gets a single treatment, determined by the supplier and the
taxpayer's economic activity
([ADR-006](006-reglas-por-proveedor-y-actividad-economica.md)).

**Vouchers with `IVA = 0` don't enter the classification cascade.** With
no VAT there's no possible tax credit, no credit category to decide, and
no factor to apply. They go to an aggregated bucket
(`iva_category = NOT_APPLICABLE`) and their total is reported without a
per-voucher decision. **There's no need to know why the VAT is zero.**

**The limitation is stated in the UI**, not hidden (literal Spanish, since
that's the UI's language, with an English gloss for this document only):

> Los cálculos se basan en los totales de cada comprobante. Los archivos
> del SRI no incluyen el detalle de líneas, por lo que una factura con
> productos gravados y no gravados recibe un solo tratamiento. Si
> necesita desagregarla, revise el comprobante original.
>
> (Calculations are based on each voucher's totals. SRI files don't
> include line-item detail, so an invoice with both taxed and untaxed
> items receives a single treatment. If you need to break it down,
> review the original voucher.)

## Consequences

### Positive
- The data model reflects the source without inventing anything. Any
  displayed value can be traced back to a column in a file.
- Less surface for error: with no derivations, there are no
  reconciliations to fail and no rounding issues flooding the queue.
- Classification is simplified: one decision per voucher.
- The volume passing through the cascade is reduced, because `IVA = 0`
  vouchers don't enter it.

### Negative
- **A mixed invoice gets reported whole in a single taxable-base field.**
  It's incorrect in the detail, even though the tax credit — which is the
  VAT, and that part is exact — comes out right. The UI notice is the
  mitigation, not the solution.
- The `IVA = 0` bucket can't be split between 0%, exempt, and not subject.
  If the form distinguishes them, the user has to adjust manually.
- If the voucher's XML — which does carry line items — is ingested later,
  two levels of precision will coexist depending on the data's origin.
  This is resolved with `source_files.kind`, but it has to be anticipated
  when designing the reports.

## Alternatives considered

**Derive `taxed_base = IVA / rate`.** Would allow correctly splitting mixed
invoices. Discarded for the MVP: it adds an invented value, with its own
tolerances and failures, to fix a case the notice reasonably covers. Can be
reconsidered if real usage shows mixed invoices are frequent and material.

**Require the XML instead of the TXT.** Would resolve the line-item detail
at the root, but downloading one XML per voucher manually isn't viable.

**Send mixed invoices to the queue.** Accurate but unusable: any
supermarket or pharmacy purchase would land there.
