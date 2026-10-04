# VAT rates

Feeds the `tax_rates` table. The applicable rate is resolved by the
**voucher's issue date**, never by the current date
([ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md)).

## Table

| Rate | Effective from | Effective until | Source | Verified |
|---|---|---|---|---|
| 15% | `[VERIFICAR]` 2024 | — | `[VERIFICAR]` | ❌ |
| 12% | `[VERIFICAR]` | `[VERIFICAR]` 2024 | `[VERIFICAR]` | ❌ |

> **No row is verified.** Before loading this table into the system, the
> exact effective dates must be confirmed against the regulation and the
> source recorded. Until then, the system must not calculate periods
> prior to the confirmed effective date of the current rate.

## Available evidence

From the real invoice analyzed in
[`formato-archivos-sri.md`](formato-archivos-sri.md):

```
VALOR_SIN_IMPUESTOS = 29.99    IVA = 4.50
4.50 / 29.99 = 15.005%    →    15% rate, with rounding
```

Confirms that in August 2026 the rate is 15%. **It does not confirm
since when.**

## Why the effective date matters

With the rate hardcoded, a voucher from a period before the reform gets
calculated with the wrong rate **without producing any visible error**.
The system shows a number, and that number is wrong.

It matters when:
- The user corrects or rebuilds an earlier period.
- A voucher arrives with an old issue date.
- A credit note modifies an invoice issued under the previous rate.

## Zero rate, exempt, and non-object

SRI files carry `IVA = 0` without distinguishing between the three
cases. That distinction isn't modeled because **the source doesn't
contain it**
([ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md)).

They're grouped into a single bucket with no per-voucher decision. If
the form separates them, the user adjusts manually, and the interface
warns about it.
