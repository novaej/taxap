# Form 104 — Fields and relationship to results

**Source:** VAT filing receipt downloaded from the SRI portal
(obligation `2011 DECLARACION DE IVA`, August 2026 period, 6 pages).
**Verified:** 2026-09-20. The original PDF is not stored in the project; the
local copy lives in `samples/`, outside the repository, because it
contains real tax data.

> **The form is the destination of the results, not a calculation source.**
> taxap calculates with its own logic (`src/domain/`) from the vouchers and
> what the user marks. Each result is presented next to the field where
> the user must enter it:
>
> ```
> Purchases with the right to tax credit (gross value) — 500 = 1,000.00
> ```
>
> The admin uploads the form once and the system saves its complete field
> catalog. When calculating, the system **relates each result to the
> corresponding field**, approximately, by its meaning; the code knows
> nothing about field codes ([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).
> The formulas printed on the form are transcribed here as reference for
> whoever implements the domain; the system never reads or executes them.
> The values on the sample PDF are not used for anything.

**The MVP covers only the monthly form, and only the basics of sales and
purchases.**

---

## How it's built

Each row of the form has a description and one of three formats:

| Format | Example | Columns |
|---|---|---|
| **Triple** | `500 · 510 · 520` | Gross value · Net value · Tax generated |
| **Single value** | `499` | A single field |
| **Count or text** | `111`, `881` | Number of vouchers, or `SI`/`NO` |

**Net value = gross value − credit notes.** Credit notes subtract from
the net amount; they don't count as an additional purchase or sale
([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)).

The triples follow a numeric pattern, useful for validating the PDF
reading: `401·411·421`, `500·510·520`, `502·512·522`.

Sections, in order:

| Section | Fields | MVP |
|---|---|---|
| Header and tourism decree | 203 | Out |
| **Sales summary** | 401–454 | **Yes (basic)** |
| VAT settlement for the month | 480–499, 111, 113 | Out |
| **Purchases and payments summary** | 500–565, 115–119 | **Yes (basic)** |
| Tax summary | 601–624 | Out |
| Subtotal due and consolidated | 620–699, 859 | Out |
| ISD refund for exporters | 700–702 | Out |
| VAT withholding agent | 721–802 | Out |
| Payments, application, and amounts due | 880–999 | Out |

---

## MVP results and expected field

Each result has a **stable key** and a **structured description**
defined in the domain:

| Attribute | Values |
|---|---|
| Operation | sale · purchase |
| Treatment | taxed · 0% with right to credit · 0% without right · export of goods · export of services · non-object or exempt · with right to credit · without right to credit |
| Column | gross · net · tax |
| Fixed asset | no (the MVP doesn't distinguish them) |

The system compares that description against the official names in the
form's catalog and suggests the closest field
([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)). The
relationship is an approximation: it's always shown with the field's
official name and **the reason it was placed there**. Nobody corrects it
by hand.

**The "Field" columns in the tables below are not used by the system.**
They are the field **expected** for each result in this version of the
form, and they serve as a **test set for the matching logic**: if a rule
change or a new form causes a result to no longer land where expected,
the test catches it.

### Sales — from `invoices_issued`

| Result key | Gross · Net · Tax | Description on the form | What feeds it |
|---|---|---|---|
| `SALES_TAXED` | 401 · 411 · 421 | Local sales (excluding fixed assets) taxed at a rate other than zero | Vouchers with `IVA > 0` |
| `SALES_ZERO_NO_CREDIT` | 403 · 413 | Local sales taxed at 0% that do **not** carry the right to tax credit | Marked by the user |
| `SALES_ZERO_WITH_CREDIT` | 405 · 415 | Local sales taxed at 0% that **do** carry the right to tax credit | Marked by the user |
| `EXPORT_GOODS` | 407 · 417 | Exports of goods | Marked by the user |
| `EXPORT_SERVICES` | 408 · 418 | Exports of services and/or rights | Marked by the user |
| `SALES_NON_OBJECT_EXEMPT` | 431 · 441 | Transfers non-object or exempt from VAT | Marked by the user |

Net = gross − issued credit notes. The tax column only applies to
`SALES_TAXED`.

### Purchases — from `invoices_received`, `IVA > 0` only

| Result key | Gross · Net · Tax | Description on the form | What feeds it |
|---|---|---|---|
| `PURCHASES_WITH_CREDIT` | 500 · 510 · 520 | Purchases and payments (excluding fixed assets) taxed at a rate other than zero **with** the right to tax credit | `iva_category = CREDIT` |
| `PURCHASES_NO_CREDIT` | 502 · 512 · 522 | Other purchases and payments taxed at a rate other than zero **without** the right to tax credit | `iva_category = COST_EXPENSE` and `NON_DEDUCTIBLE` `[VERIFICAR]` |

### Factor and credit

| Result key | Field | Description on the form |
|---|---|---|
| `PROPORTIONALITY_FACTOR` | 563 | Proportionality factor for tax credit |
| `CREDIT_APPLICABLE` | 564 | Tax credit applicable for this period |
| `VAT_NOT_CREDITED` | 565 | Amount of VAT not considered as tax credit due to the proportionality factor |

It's possible the portal calculates these three from what's entered in
sales and purchases; in that case the system provides them as a
**cross-check value**, not something the user has to type in
`[VERIFICAR]`.

### With no definitive field

| Result key | What it is | Status |
|---|---|---|
| `PURCHASES_ZERO_VAT` | Total purchases with `IVA = 0` | Doesn't affect the VAT credit. Shown as an informational total. Since the system relates by meaning, it may suggest the closest field (507, with 508, 531, and 532 as alternatives) **marked as approximate**; the user decides whether to use it. |

A result with no identified field is valid: it's shown with no code and
doesn't block anything.

### What these results leave ready for Income Tax

Income Tax is outside the MVP, but the results already carry what will
later feed into it:

- Purchase base and VAT by destination (`PURCHASES_WITH_CREDIT`,
  `PURCHASES_NO_CREDIT`).
- **The VAT that becomes a cost:** that of `PURCHASES_NO_CREDIT` plus
  `VAT_NOT_CREDITED`.
- Total sales by destination.
- `PURCHASES_ZERO_VAT`, which doesn't matter for the credit since it
  carries no VAT, but is a potential expense for Income Tax.

---

## The proportionality factor

Reference formula (not executed; the logic lives in `src/domain/`):

```
563 = (411+412+420+435+415+416+417+418) / 419
564 = (520+521+534+560+523+524+525+526−527) × 563
```

Within the MVP's scope, the numerator is `411 + 415 + 417 + 418` and the
credit is `520 × 563`.

**Exports (417, 418) and 0% sales with the right to credit (415, 416)
count in the numerator.** A taxpayer whose sales are only exports of
services has a factor of **1.0000**. The factor is only zero if all
sales fall into destinations that don't enter the numerator (403, 404,
431).

> Earlier documents said that sales with no VAT gave a zero factor. That
> was incorrect. It's a fact about the logic the domain must implement,
> not data the system takes from the form.

Format: **4 decimal places** (`1.0000`).

**Blocking:** the factor is not calculated while there are sales with
`IVA = 0` whose destination hasn't been marked by the user. A factor
computed over unclassified sales would be a number that only looks
exact.

**Pending case:** with no sales in the period, the denominator is zero
and the factor is a 0/0 division. What result the system should offer
still needs to be defined `[VERIFICAR]`.

---

## Decisions made

**Sales with `IVA = 0`: marked by the user in a table.** After the
issued vouchers are loaded, the system displays them and the user marks
the actual destination of each sale with `IVA = 0`, one at a time or in
bulk. Sales with `IVA > 0` go straight to `SALES_TAXED` on their own.
The issued-invoices file carries no customer or description, so there
are no learned rules: the criterion is always the user's. Every mark is
logged in the audit log ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

**Purchases with `IVA = 0`: no per-voucher decision.** They don't affect
the credit, so they aren't split among 507, 508, 531, and 532. The
vouchers are kept and an informational total is shown
(`PURCHASES_ZERO_VAT`), with a suggested approximate field.

**Only the basics of sales and purchases.** The system delivers what to
enter for sales and purchases. It doesn't calculate the settlement, the
prior month's credit balances, or the total due.

**No `attribution`.** The data model used to have an attribution
category (direct taxed, direct exempt, proratable). It's removed: the
form already expresses this with 500 (with right to credit) and 502
(without right), plus the factor. The classification of a purchase is
**500 or 502**, decided by the user or the learned rule, not a third
concept. Whether a purchase attributable only to exempt sales belongs in
502 is up to the user's judgment `[VERIFICAR]`.

**Only the monthly form.** The semiannual one is a different form, with
its own fields, and is out of scope. A semiannual taxpayer can be
registered, but the MVP doesn't generate their pre-filing and says so.

---

## Out of the MVP

| Fields | Concept | Reason |
|---|---|---|
| 402·412·422, 404·414, 406·416, 501·511·521 | Fixed assets | The file doesn't distinguish a fixed asset from another purchase. Everything goes to 401 / 500; the user adjusts by hand. |
| 410·420·430, 530·533·534 | Variable rate | Would require deriving the rate from `IVA / subtotal`, which [ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md) rules out. |
| 425·435·445, 540·550·560 | 5% rate | Same as above. |
| 503–505, 523–525 | Imports | Documented via the customs declaration. |
| 423, 424, 526, 527 | Rate-difference adjustments | Require detail the file doesn't carry. |
| 442, 443, 453, 543, 544, 554 | Credit notes to offset next month | Edge case of ADR-010. |
| 434, 444, 454, 535, 545, 555 | Reimbursements as an intermediary | Informational. |
| 506–508, 516–518, 531–532, 541–542 | Purchases with `IVA = 0` | No effect on the credit. |
| 409·419·429, 509·519·529 | Totals | The portal sums these `[VERIFICAR]`. They're not "what to enter," they're a consequence. |
| 111–119 | Voucher counts | Informational. `[VERIFICAR]` whether mandatory. |
| 480–499 | Settlement for the month | Outside "what to enter in sales and purchases." |
| 601–625 | Tax summary, **prior months' credit balances (605)**, offsets, adjustments | Balances come from the previous filing, not from the vouchers. Out. |
| 620–699, 859 | Subtotal, sales withholdings, consolidated total | Out. |
| 700–802 | ISD, VAT withholding agent | A different tax role. |
| 880–999 | Payments, interest, penalties, deferred COVID payment | Happen after the filing. |
| 203 | Tourism rate decree | A selector; not applicable. |

### Two cases to revisit later

- **609** (VAT withholdings applied to the taxpayer): received
  withholding vouchers could feed this. [ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)
  treats them as "not applicable" for purchases, which is correct for
  500/502, but that doesn't mean they're worth nothing. Needs a real
  file with a withholding voucher `[VERIFICAR]`.
- **605** and the other balances: if covering the settlement is decided
  on, a carry-forward mechanism between periods or manual entry will be
  needed.

---

## Pending verification

- [ ] Whether the portal calculates 563, 564, and 565 from the entered
      sales and purchases
- [ ] Whether the portal sums totals 409/419/429 and 509/519/529
- [ ] Factor value when there are no sales (zero denominator)
- [ ] Treatment of `NON_DEDUCTIBLE` relative to 502
- [ ] Criterion for purchases attributable only to exempt sales
- [ ] Whether received withholding vouchers feed field 609
- [ ] Effective date of this form version: a sample PDF only states the
      filing period, not since when the form has been in effect
