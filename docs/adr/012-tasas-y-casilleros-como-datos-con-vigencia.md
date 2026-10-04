# ADR-012: Rates and fields as data with effective dates

> **Partially superseded (2026-09-20):** the single `form_casillero_map`
> table described below is replaced by `form_versions`, `form_fields`, and
> `result_mappings`: an administrator imports the form from a PDF, the
> system stores its catalog, and relates each result to its field by
> meaning. See [ADR-015](015-definicion-del-formulario-desde-pdf.md).
> Everything else — rates with effective dates, lookup by the date of the
> event, visibility for the user — still stands.

## Status
Accepted

## Date
2026-09-20

## Context

Two values can't live as constants in the code:

**The VAT rate.** It used to be 12% and today it's 15%. The applicable
rate depends on the **voucher's emission date**, not the current date. A
user correcting a past period needs the rate that was in effect then.
With the rate fixed in code, the system silently miscalculates for any
old voucher.

**Form 104's field map.** It's literally the product's output: every
total has to land in the right field. If the SRI modifies the form, with
the map in constants every change demands a deployment — and the ability
to reproduce a past period with the form that governed it then is lost.

There's a third value that does **not** belong here. A table mapping
regime → filing frequency to infer whether a taxpayer files monthly or
semiannually was considered. It was discarded: **the SRI assigns filing
frequency directly, and it's recorded in the taxpayer's RUC.** Inferring
it would be second-guessing the authoritative source. The user enters it
when registering each taxpayer, and it's editable.

## Decision

**Two reference tables with effective dates, administered by the system
and visible to the user.**

```
tax_rates          (tax, rate, valid_from, valid_to)
form_casillero_map (form_code, form_version, casillero, description,
                    expression, valid_from, valid_to)
```

Every lookup is resolved **by the date of the event**, not the current
date: the rate is looked up by the voucher's emission date, and the field
map by the period's date.

**Visible to the user.** A user must be able to open a field and see
which rate and which form version the system used. This isn't an
implementation detail: it's what allows verifying the calculation instead
of trusting it blindly, and it's consistent with
[ADR-014](014-caracter-asistivo-y-disclaimers.md).

Human-facing documentation is in [`docs/tax/`](../tax/), which records
where each value came from and when it was verified.

## Consequences

### Positive
- Past periods are recalculated with the rules that governed them at the
  time.
- A rate reform is a new row, not a deployment.
- The user can audit the system's assumptions, which builds trust better
  than any marketing copy.

### Negative
- Every operation involving money needs a rate lookup by date. Solved
  with an in-memory cache, but it's a dependency that pure `domain/` code
  can't resolve on its own: the rate is **passed in** as a parameter, not
  looked up by it.
- The tables have to be maintained. A regulatory change nobody loads
  means incorrect calculations that look normal. There should be an alert
  when a period uses an effective-date range that has already expired.

## Alternatives considered

**Constants in TypeScript.** Simpler and type-checked. Discarded: it makes
recalculating past periods impossible and turns every reform into a
deployment.

**Have the user enter the rate.** Would shift the problem onto someone who
shouldn't have to carry it, and would produce inconsistencies between
taxpayers of the same user.
