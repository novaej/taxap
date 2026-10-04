# ADR-010: Voucher-type allowlist

## Status
Accepted

## Date
2026-09-20

## Context

The SRI's received-vouchers download doesn't contain invoices only. It
includes credit notes, debit notes, purchase settlements, and withholding
receipts, in the `TIPO_COMPROBANTE` column.

There's a reasonable intuition that only invoices count for VAT. **It's
wrong, and the error goes in the dangerous direction.**

A **received credit note** reverses part of a purchase — a return, a
later discount, a correction — and carries VAT. If the credit from the
original invoice was already taken and the note is ignored, credit is
being claimed for something that was returned. That's an error in the
taxpayer's favor, exactly the kind the tax authority detects.

## Decision

**An allowlist with explicit treatment per type. Never an exclusion
list.**

| Type | Treatment in purchase VAT |
|---|---|
| Invoice | Adds |
| Credit note | **Subtracts** — linked via `NUMERO_DOCUMENTO_MODIFICADO` |
| Debit note | Adds |
| Purchase settlement | Adds |
| Withholding receipt | **Not applicable** — it's a withholding received, not a purchase |

**Any unrecognized type goes to the review queue.** It's neither discarded
nor silently included. If the SRI introduces a new type, the system flags
it instead of silently getting it wrong.

Credit notes are netted against the voucher they modify. When the
referenced document isn't in the loaded period — because the original
invoice belongs to an earlier period — the note is still processed, but
flagged, because it may require an adjustment the system can't resolve on
its own.

## Note: withholding receipts and field 609

"Not applicable" means a withholding receipt **isn't a purchase** and
doesn't go to the acquisitions fields. It doesn't mean it has no use:
form field 609 (VAT withheld from the taxpayer during the period) could be
populated from them. Pending verification against a real file; see
[`formulario-104.md`](../tax/formulario-104.md).

## Verification status

> **Pending empirical confirmation.** The treatments in this table come
> from reasoning about the domain, not from inspecting real files. The
> exact `TIPO_COMPROBANTE` literals must be verified against real
> downloads that include each type, and this table updated accordingly.
>
> Until then, the allowlist is conservative: any unrecognized literal goes
> to the queue, so a misspelled literal produces manual work, not an
> incorrect calculation.

## Consequences

### Positive
- The tax credit isn't overstated by ignoring credit notes.
- An unknown type produces a question for the user, not a silent error.
- The treatment rules live in one place and are tested without a
  database.

### Negative
- Netting credit notes against vouchers from other periods is a genuine
  edge case the MVP flags but doesn't resolve automatically.
- The allowlist requires upkeep. If the SRI renames a type, every voucher
  of that type falls into the queue until someone notices — visible
  friction, but in the safe direction.
