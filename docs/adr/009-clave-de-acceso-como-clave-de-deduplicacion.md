# ADR-009: The access key as the deduplication and integrity key

## Status
Accepted

## Date
2026-09-20

## Context

The SRI portal only allows querying vouchers **by day**. A monthly period
requires up to 31 downloads, and a semiannual one many more. The user is
going to upload dozens of files per period, with overlaps and repeats
nearly guaranteed.

Without a reliable deduplication key, the second upload duplicates the
totals and the product loses the user's trust on their first use.

Every voucher carries the **access key**, 49 digits the SRI generates with
a fixed structure:

```
date(8) type(2) RUC(13) environment(1) series(6) sequence(9) code(8) emission(1) check digit(1)
```

Verified against two real vouchers:

```
0108202601 1791287541001 2 001012 024304725 ...
  01/08/26   issuer RUC      001-012  024304725
```

The internal fields **match the file's other columns**: emission date,
voucher type, issuer RUC, and series.

## Decision

**The access key serves two functions.**

**1. Deduplication.** Unique constraint `(taxpayer_id, access_key)`.
Ingestion inserts while ignoring conflicts, so reloading a file — or the
same day appearing in two different files — duplicates nothing. The user
can upload the 31 files in any order and repeat them with no consequences.

**2. Integrity validation.** On each row, the key is decomposed and
checked against the file's other columns. If they don't match, the row is
rejected and reported: the file is corrupted or was tampered with.

**Ownership validation**, through different paths depending on the file:

| File | How the taxpayer is validated |
|---|---|
| Received vouchers | `IDENTIFICACION_RECEPTOR` must match the taxpayer |
| Issued vouchers | The RUC **inside the access key** must be the taxpayer's |

The issued-vouchers file carries no issuer-identification column; the
access key supplies it. If it doesn't match, the whole upload is aborted:
the user uploaded another client's file, and catching that before it
contaminates the period is what matters.

## Consequences

### Positive
- Reloading is idempotent by construction. The UI can offer "drop in all
  your files" with no warning needed.
- Early detection of corrupted files or the wrong client's file, before
  they reach a calculation.
- No need to invent a composite natural key or rely on the file name.

### Negative
- Assumes the SRI never reuses access keys across vouchers. That's the
  system's design, but it's an external dependency.
- Cross-validation can reject legitimate rows if the SRI changes a
  column's format (for example, the date format). That's why a rejection
  **reports the row to the user** instead of silently discarding it.
- `sha256` over the whole file catches an identical re-upload before
  parsing, but it doesn't replace per-row deduplication: two different
  files can share vouchers.
