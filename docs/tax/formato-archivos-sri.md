# SRI file format

Specification of the files the user downloads from the SRI portal and
uploads to taxap. **Verified against real files on 2026-09-20.**

These are **tab-separated `.txt` files**, not CSV. The parser is
configured with an explicit delimiter; autodetection is not used.

---

## Received vouchers (purchases)

12 columns:

```
RUC_EMISOR · RAZON_SOCIAL_EMISOR · TIPO_COMPROBANTE · SERIE_COMPROBANTE
CLAVE_ACCESO · FECHA_AUTORIZACION · FECHA_EMISION · IDENTIFICACION_RECEPTOR
VALOR_SIN_IMPUESTOS · IVA · IMPORTE_TOTAL · NUMERO_DOCUMENTO_MODIFICADO
```

Real row:

```
1791287541001 │ MEGADATOS S.A. │ Factura │ 001-012-024304725
0108202601179128754100120010120243047251660131514
01/08/2026 04:05:03 │ 01/08/2026 │ 1715824775 │ 29.99 │ 4.5 │ 34.49 │ (empty)
```

| Column | Type | Notes |
|---|---|---|
| `RUC_EMISOR` | 13 digits | The supplier |
| `RAZON_SOCIAL_EMISOR` | text | Main classification signal |
| `TIPO_COMPROBANTE` | text | Holds the type's **name** (verified: `Factura`), not the SRI code. The allowlist ([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)) is checked against the code in digits 9-10 of `CLAVE_ACCESO` (`01` = invoice) |
| `SERIE_COMPROBANTE` | `EEE-PPP-SSSSSSSSS` | Establishment, emission point, sequence number |
| `CLAVE_ACCESO` | 49 digits | Deduplication key — see below |
| `FECHA_AUTORIZACION` | `DD/MM/AAAA HH:MM:SS` | |
| `FECHA_EMISION` | `DD/MM/AAAA` | **Determines the period**, not the authorization date |
| `IDENTIFICACION_RECEPTOR` | 10 or 13 digits | The taxpayer. National ID (cédula) if a natural person |
| `VALOR_SIN_IMPUESTOS` | decimal | Stored as-is |
| `IVA` | decimal | `0` on vouchers with no IVA |
| `IMPORTE_TOTAL` | decimal | |
| `NUMERO_DOCUMENTO_MODIFICADO` | text or empty | Only on credit and debit notes |

## Issued vouchers (sales)

**8 columns — a different structure**, not the same file with fewer
fields:

```
COMPROBANTE · SERIE_COMPROBANTE · CLAVE_ACCESO · FECHA_AUTORIZACION
FECHA_EMISION · VALOR_SIN_IMPUESTOS · IVA · IMPORTE_TOTAL
```

Real row:

```
Factura │ 001-001-000000034
0309202601171582477500120010010000000344465382615
04/09/2026 07:32:13 │ 03/09/2026 00:00:00 │ 2500 │ 0 │ 2500
```

Three differences that require a dedicated parser:

1. The column is called **`COMPROBANTE`**, not `TIPO_COMPROBANTE`.
2. **There's no issuer or recipient identification.** Ownership is
   validated with the RUC embedded in the access key.
3. **There's no `NUMERO_DOCUMENTO_MODIFICADO`.**
4. `FECHA_EMISION` includes a time (`00:00:00`); in purchases it
   doesn't.

---

## The access key

49 digits with a fixed structure:

| Position | Length | Field |
|---|---|---|
| 0–7 | 8 | Issue date `DDMMAAAA` |
| 8–9 | 2 | Voucher type |
| 10–22 | 13 | **Issuer's RUC** |
| 23 | 1 | Environment (1 test, 2 production) |
| 24–29 | 6 | Series: establishment + emission point |
| 30–38 | 9 | Sequence number |
| 39–46 | 8 | Numeric code |
| 47 | 1 | Emission type |
| 48 | 1 | Check digit |

### Verification against the real examples

**Purchase — MEGADATOS:**
```
0108 2026 01 1791287541001 2 001012 024304725 4716601 3 1514
```
| Field extracted | File column | Match? |
|---|---|---|
| `01082026` | `FECHA_EMISION` = 01/08/2026 | Yes |
| `1791287541001` | `RUC_EMISOR` | Yes |
| `001012` | `SERIE_COMPROBANTE` = 001-012-… | Yes |
| `024304725` | `SERIE_COMPROBANTE` = …-024304725 | Yes |

**Sale:**
```
0309 2026 01 1715824775001 2 001001 000000034 44653826 1 5
```
| Field extracted | File column | Match? |
|---|---|---|
| `03092026` | `FECHA_EMISION` = 03/09/2026 | Yes |
| `1715824775001` | *(no column)* | It's the taxpayer's RUC |
| `001001` | `SERIE_COMPROBANTE` = 001-001-… | Yes |
| `000000034` | `SERIE_COMPROBANTE` = …-000000034 | Yes |

**Operational conclusion:** the access key is self-descriptive and
cross-validates the other columns. It serves simultaneously to
deduplicate, verify integrity, and confirm ownership
([ADR-009](../adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)).

> In the sample sale, `1715824775001` is the taxpayer's RUC, made up of
> the national ID (cédula) `1715824775` —the same one that appears as
> `IDENTIFICACION_RECEPTOR` in the purchases file— plus `001`. Both files
> belong to the same taxpayer.

---

## Operational constraints

**The SRI only allows querying by day.** A monthly period may require 31
downloads. Design consequences:

- Upload must accept **multiple files at once** and allow adding more to
  a period that's already underway.
- Days with no activity produce files with **only a header**. These are
  not an error.
- Deduplication by access key makes order and repetition irrelevant.

**Cases verified in the examples:**

- `IVA = 0` on sales. In the example, a $2,500 sale with no IVA. The
  file **does not say** whether it's an export, a 0% sale with the right
  to credit, 0% without the right, or non-object: these are different
  form destinations, and the proportionality factor depends on which one
  applies. See [`formulario-104.md`](formulario-104.md).
- Decimals with no trailing zeros: `4.5`, not `4.50`. The parser must
  not assume two decimal places in the source text.
- Whole amounts with no decimal separator: `2500`.

---

## Pending verification

- [ ] Exact literal values of `TIPO_COMPROBANTE` for credit notes, debit
      notes, purchase settlements, and withholding vouchers. Only
      invoices have been verified.
- [ ] Format of `NUMERO_DOCUMENTO_MODIFICADO` on a real credit note.
- [ ] Whether the purchases file supports date ranges or is also
      per-day only.
- [ ] Presence and exact format of the header row.
- [ ] File encoding (UTF-8 or Latin-1) — affects business names with
      accents and `Ñ`.
