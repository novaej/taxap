# Data model

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). This
document is the readable version of that file — if they differ, the schema
wins.

Conventions:

- **Primary keys**: `UUID` with `DEFAULT uuidv7()` — a native function since
  PostgreSQL 18, no extension needed. They sort chronologically and are not
  enumerable.
- **Columns**: `camelCase` in Prisma/TypeScript, `snake_case` in Postgres via
  `@map` on each field (not just on the table name). Missing this was a real
  RLS bug — see CLAUDE.md → "Easy mistakes to make here."
- **Money**: `DECIMAL(14,2)`. Never `float`, never JavaScript's `number`.
  In TypeScript it's handled as `Prisma.Decimal`.
- **Tax dates**: `DATE` with no time zone. A voucher issued on 08/31
  belongs to August regardless of where the server is located.
- **Isolation**: RLS via `app.current_user_id`, with an explicit sentinel id
  for `asAdmin()` — never a variable left simply unset
  ([ADR-004](adr/004-rls-por-usuario-con-prisma.md), update note).

---

## Identity and access

### `users`

No RLS — this isn't taxpayer data.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `email` | TEXT | unique |
| `password_hash` | TEXT | bcrypt |
| `first_name`, `last_name` | TEXT | nullable |
| `role` | ENUM | `INDIVIDUAL` \| `ACCOUNTANT` \| `ADMIN` |
| `plan_code` | TEXT | FK to `plans.code`, default `STARTER` |
| `ai_enabled` | BOOLEAN | default `true` |
| `created_at` | TIMESTAMP | |

### `plans`

| Column | Type | Notes |
|---|---|---|
| `code` | TEXT | PK |
| `max_taxpayers` | INT | |
| `max_users` | INT | collaborators; default 1 |
| `ai_included` | BOOLEAN | default `true` |

Seeded by `prisma/seed.ts`: `STARTER` (1 taxpayer), `PROFESSIONAL`
(10), `ENTERPRISE` (100, 5 users).

### `user_taxpayers`

A join table from day one, even though today every taxpayer has
exactly one row ([ADR-003](adr/003-usuario-como-tenant-con-tabla-de-union.md)).
**Under RLS.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK |
| `taxpayer_id` | UUID | FK |
| `access` | ENUM | `OWNER` \| `COLLABORATOR`, default `OWNER` |
| `created_at` | TIMESTAMP | |

Unique `(user_id, taxpayer_id)`.

---

## Taxpayers and periods

### `taxpayers`

**Under RLS.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `ruc` | TEXT | unique |
| `business_name` | TEXT | |
| `trade_name` | TEXT | nullable |
| `regime` | ENUM | `RIMPE_POPULAR` \| `RIMPE_EMPRENDEDOR` \| `GENERAL`, default `GENERAL` |
| `iva_periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` \| `ANNUAL`, default `MONTHLY` — entered by the user, editable |
| `economic_activities` | JSONB | `[{code, description}]` |
| `activity_fingerprint` | TEXT | hash of the set of activities |
| `created_by` | UUID | FK to `users` — not part of the original design; see note below |
| `created_at` | TIMESTAMP | |

`activity_fingerprint` is recalculated whenever activities are edited. When
it changes, supplier rules issued under the previous value are left pending
revalidation ([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)).

> **`created_by` was not in the original design.** It was added because
> `Prisma.create()` always does an `INSERT ... RETURNING`, and Postgres
> filters `RETURNING` through the `SELECT` policy: without this column, the
> creator couldn't see the row they had just inserted until the link in
> `user_taxpayers` existed (which is created in the following statement, not
> the same one) — in practice, nobody could create a taxpayer at all. The
> `SELECT`/`UPDATE` policy accepts `created_by = current user` in addition to
> membership via `user_taxpayers`.

### `tax_periods`

**Under RLS.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `tax_type` | ENUM | `IVA` \| `INCOME_TAX` \| `WITHHOLDING`, default `IVA` — only `IVA` has implemented logic |
| `period_start`, `period_end` | DATE | |
| `periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` \| `ANNUAL`, default `MONTHLY` |
| `status` | ENUM | `DRAFT` \| `UNDER_REVIEW` \| `FILED` |
| `form_version_id` | UUID | FK, nullable — the form version the filing used |
| `proportionality_factor` | DECIMAL(5,4) | nullable until calculated |
| `factor_inputs` | JSONB | nullable |
| `filed_at`, `locked_at` | TIMESTAMP | nullable |
| `created_at`, `updated_at` | TIMESTAMP | |

Unique `(taxpayer_id, tax_type, period_start)`.

A Postgres trigger rejects INSERT, UPDATE, and DELETE on
`invoices_received`/`invoices_issued` for the period while `locked_at` is
set (`prisma/migrations/*_add_period_lock/`,
[ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

### `source_files`

**Under RLS.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `tax_period_id` | UUID | FK, nullable |
| `kind` | ENUM | `PURCHASES_TXT` \| `SALES_TXT` |
| `filename` | TEXT | |
| `sha256` | TEXT | detects re-upload of the identical file |
| `row_count`, `rows_imported`, `rows_rejected` | INT | default 0 |
| `uploaded_by` | UUID | FK to `users` |
| `uploaded_at` | TIMESTAMP | |

---

## Vouchers

### `invoices_received`

Mirrors the columns of the SRI file, without inventing fields
([ADR-008](adr/008-solo-totales-sin-detalle-de-lineas.md)). **Under RLS.**

| Column | Type | Source / notes |
|---|---|---|
| `id` | UUID | |
| `taxpayer_id`, `tax_period_id` | UUID | FK |
| `source_file_id` | UUID | FK, nullable |
| `access_key` | CHAR(49) | `CLAVE_ACCESO` |
| `supplier_ruc` | TEXT | `RUC_EMISOR` |
| `supplier_name` | TEXT | `RAZON_SOCIAL_EMISOR` — main classification signal |
| `document_type` | TEXT | `TIPO_COMPROBANTE` |
| `series` | TEXT | `SERIE_COMPROBANTE` |
| `issue_date` | DATE | `FECHA_EMISION` — determines the period |
| `authorization_date` | TIMESTAMP | `FECHA_AUTORIZACION`, nullable |
| `subtotal` | DECIMAL(14,2) | `VALOR_SIN_IMPUESTOS`, as-is |
| `vat_amount` | DECIMAL(14,2) | `IVA`, as-is |
| `total` | DECIMAL(14,2) | `IMPORTE_TOTAL` |
| `modified_document` | TEXT | `NUMERO_DOCUMENTO_MODIFICADO`, nullable |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` \| `NOT_APPLICABLE` \| `UNCLASSIFIED` |
| `processing_status` | ENUM | `UNCLASSIFIED` \| `PROCESSED` \| `REQUIRES_MANUAL_REVIEW` \| `EXCLUDED` |
| `classification_source` | ENUM | `RULE` \| `CATALOG` \| `AI` \| `USER` \| `DETERMINISTIC`, nullable |
| `applied_rule_id` | UUID | nullable |
| `ai_confidence` | DECIMAL(3,2) | nullable |
| `ai_reasoning` | TEXT | nullable |
| `created_at`, `updated_at` | TIMESTAMP | |

Unique `(taxpayer_id, access_key)` — the deduplication key.

`iva_category = NOT_APPLICABLE` is the `IVA = 0` bucket: it does not go
through the cascade. `processing_status` starts at `UNCLASSIFIED` after
ingestion; `classifyPeriod()` moves it to `PROCESSED` or
`REQUIRES_MANUAL_REVIEW`.

> **No derived base is stored.** `subtotal` and `vat_amount` are exactly
> what the file provides.

### `invoices_issued`

The issued-invoices file has **fewer columns** than the received one: it
carries no recipient identification or business name. **Under RLS.**

| Column | Source / notes |
|---|---|
| `id`, `taxpayer_id`, `tax_period_id`, `source_file_id` | same as received |
| `access_key` | `CLAVE_ACCESO` |
| `document_type` | `COMPROBANTE` (note: not `TIPO_COMPROBANTE`) |
| `series` | `SERIE_COMPROBANTE` |
| `issue_date`, `authorization_date` | `FECHA_EMISION` includes a time here; it doesn't in received invoices |
| `subtotal`, `vat_amount`, `total` | as-is |
| `sales_treatment` | ENUM: `TAXED` (automatic) \| `ZERO_WITH_CREDIT` (405) \| `ZERO_NO_CREDIT` (403) \| `EXPORT_GOODS` (407) \| `EXPORT_SERVICES` (408) \| `NON_OBJECT_EXEMPT` (431) \| `UNCLASSIFIED` (initial) |
| `created_at`, `updated_at` | |

Unique `(taxpayer_id, access_key)`.

`sales_treatment` exists because the file doesn't say which destination a
sale with `IVA = 0` corresponds to. **The user marks it** on the issued
sales screen; the proportionality factor is not calculated while any sale
remains `UNCLASSIFIED`.

---

## Classification engine

### `supplier_rules`

The rule is per taxpayer, revocable, never deleted
([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)). **Under RLS.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `supplier_ruc` | TEXT | |
| `activity_fingerprint` | TEXT | context under which it was decided |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` |
| `source` | ENUM | `USER` \| `CATALOG` \| `AI` |
| `created_by` | UUID | nullable if created by the engine |
| `times_applied` | INT | default 0 |
| `revoked_at` | TIMESTAMP | nullable |
| `applied_at` | TIMESTAMP | |

### `shared_supplier_catalog`

Global, anonymous aggregate. **No taxpayer or user identifiers**
([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)). No
RLS. **Not implemented yet** — cascade level 2 passes an
empty array (see `docs/guides/code-flow.md`).

| Column | Type |
|---|---|
| `supplier_ruc` | TEXT (PK) |
| `supplier_name` | TEXT |
| `suggested_iva_category` | ENUM |
| `agreement_ratio` | DECIMAL(3,2) |
| `sample_count` | INT, default 1 |
| `updated_at` | TIMESTAMP |

### `classification_events`

Append-only; a trigger rejects `UPDATE` and `DELETE`
([ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)). **Under RLS**
(only `SELECT`/`INSERT` — no `UPDATE`/`DELETE` policies, further
reinforced by the trigger).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `received_invoice_id`, `issued_invoice_id` | UUID | FK, both nullable |
| `taxpayer_id`, `tax_period_id` | UUID | denormalized for the audit log |
| `field` | TEXT | what changed |
| `old_value`, `new_value` | TEXT | nullable |
| `actor_type` | ENUM | `USER` \| `ENGINE` |
| `actor_user_id` | UUID | nullable |
| `source` | ENUM | same as `classification_source`, nullable |
| `rules_version`, `model_id`, `prompt_version` | TEXT | nullable |
| `reason` | TEXT | nullable |
| `created_at` | TIMESTAMP | |

Covers both the classification of purchases and the marking of sales, and
the locking/reopening of a period — `field` distinguishes the case
(`ivaCategory`, `salesTreatment`, `status`).

---

## Normative data

### `tax_rates`

Composite PK `(tax, valid_from)`. No RLS.

| Column | Type |
|---|---|
| `tax` | ENUM (`IVA`) |
| `rate` | DECIMAL(5,4) |
| `valid_from`, `valid_to` | DATE, `valid_to` nullable |
| `source` | TEXT — where the value comes from (CLAUDE.md → "Normative values") |
| `verified_at` | DATE — when that source was verified |
| `created_by` | UUID → `users.id`, the admin who loaded it |

**Empty today.** No value in [`docs/tax/tasas-iva.md`](tax/tasas-iva.md)
is verified yet — CLAUDE.md forbids loading a `[VERIFICAR]` from
memory. `source`/`verified_at`/`created_by` were added together with the
admin screen (`/admin/tasas`) — before 2026-10-04 the
schema had nowhere to record where a rate came from, even though the rule
already existed in CLAUDE.md.

### Form and relationship to results ([ADR-015](adr/015-definicion-del-formulario-desde-pdf.md))

The form is the **destination** of the results, not a calculation source.
No RLS (it isn't taxpayer data). The admin screen
(`/admin/formularios`) has existed since 2026-10-04 — it **remains empty in
production** until an admin uploads and publishes a real form.

```
form_versions ──< form_fields
      └──────────< result_mappings ── (result key)
```

#### `form_versions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `form_code` | TEXT | `"104"`; the MVP only supports the monthly form |
| `label` | TEXT | |
| `valid_from`, `valid_to` | DATE | set by the admin; `valid_to` nullable |
| `status` | ENUM | `DRAFT` \| `PUBLISHED` |
| `source_sha256` | TEXT | hash of the PDF; the file itself isn't stored, nullable |
| `imported_by` | UUID | FK to `users` (ADMIN), nullable |
| `imported_at`, `published_at` | TIMESTAMP | nullable |

Unique `(form_code, valid_from)`.

#### `form_fields`

The full catalog of the form, exactly as it comes out of the PDF.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `form_version_id` | UUID | FK |
| `code` | TEXT | `"500"`, `"563"`… unique per version |
| `label` | TEXT | official name |
| `section` | TEXT | nullable |
| `column_kind` | ENUM | `GROSS` \| `NET` \| `TAX` \| `SINGLE`, default `SINGLE` |
| `display_order` | INT | |
| `observed` | BOOLEAN | default `true`; `false` if a later import didn't find it |

Unique `(form_version_id, code)`. No values, no formulas, no personal
data.

#### `result_mappings`

Composite PK `(form_version_id, result_key)`.

| Column | Type | Notes |
|---|---|---|
| `form_version_id` | UUID | FK |
| `result_key` | TEXT | e.g. `PURCHASES_WITH_CREDIT` |
| `form_field_id` | UUID | FK, nullable |
| `method` | ENUM | `ATTRIBUTES` \| `AI`, default `ATTRIBUTES` |
| `reason` | TEXT | explanation shown to the user |
| `confidence` | DECIMAL(3,2) | nullable; only when `method = AI` |
| `created_at` | TIMESTAMP | |

Unique `(form_version_id, form_field_id)`. Nobody edits these rows by hand.

#### `period_results`

Composite PK `(tax_period_id, result_key)`.

| Column | Type | Notes |
|---|---|---|
| `tax_period_id` | UUID | FK |
| `result_key` | TEXT | the domain's stable key |
| `value` | DECIMAL(14,4) | 4 decimal places because of the factor (`1.0000`) |
| `computed_at` | TIMESTAMP | |

What the domain calculated. It knows nothing about form fields — the
presentation layer joins this with the `result_mappings` of the version
saved on `tax_periods`.

### `ai_usage`

Composite PK `(user_id, taxpayer_id, period)`. Usage measurement, not for
billing ([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)). No RLS.
**Empty today** — cascade levels 2 and 3 (shared catalog, AI) are not
implemented.

| Column | Type |
|---|---|
| `user_id`, `taxpayer_id` | UUID |
| `period` | DATE |
| `calls`, `input_tokens`, `output_tokens` | INT, default 0 |

---

## Tables under RLS

`taxpayers`, `user_taxpayers`, `tax_periods`, `source_files`,
`invoices_received`, `invoices_issued`, `supplier_rules`,
`classification_events`, `period_results`.

**No RLS** (they hold no taxpayer data): `users`, `plans`,
`tax_rates`, `form_versions`, `form_fields`, `result_mappings`,
`shared_supplier_catalog`, `ai_usage`.

Every table with RLS has both `ENABLE ROW LEVEL SECURITY` and
`FORCE ROW LEVEL SECURITY` — the app connects as the same role (`taxap`)
that owns the tables, and without `FORCE` Postgres exempts it from its
own policies. See
[`prisma/migrations/*_add_rls/`](../prisma/migrations/) and
[ADR-004](adr/004-rls-por-usuario-con-prisma.md).
