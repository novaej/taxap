# Modelo de datos

Fuente de verdad: [`prisma/schema.prisma`](../prisma/schema.prisma). Este
documento es la versión legible de ese archivo — si difieren, el schema
manda.

Convenciones:

- **Claves primarias**: `UUID` con `DEFAULT uuidv7()` — función nativa desde
  PostgreSQL 18, sin extensión. Ordenan cronológicamente y no son enumerables.
- **Columnas**: `camelCase` en Prisma/TypeScript, `snake_case` en Postgres vía
  `@map` en cada campo (no solo en el nombre de la tabla). La falta de esto
  fue un bug real de RLS — ver CLAUDE.md → "Errores fáciles de cometer aquí".
- **Dinero**: `DECIMAL(14,2)`. Nunca `float`, nunca `number` de JavaScript.
  En TypeScript se maneja como `Prisma.Decimal`.
- **Fechas tributarias**: `DATE` sin zona horaria. Un comprobante emitido el
  31/08 es de agosto sin importar dónde esté el servidor.
- **Aislamiento**: RLS por `app.current_user_id`, con un id centinela
  explícito para `asAdmin()` — nunca una variable simplemente sin fijar
  ([ADR-004](adr/004-rls-por-usuario-con-prisma.md), nota de actualización).

---

## Identidad y acceso

### `users`

Sin RLS — no es dato de un contribuyente.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `email` | TEXT | único |
| `password_hash` | TEXT | bcrypt |
| `first_name`, `last_name` | TEXT | nullable |
| `role` | ENUM | `INDIVIDUAL` \| `ACCOUNTANT` \| `ADMIN` |
| `plan_code` | TEXT | FK a `plans.code`, default `STARTER` |
| `ai_enabled` | BOOLEAN | default `true` |
| `created_at` | TIMESTAMP | |

### `plans`

| Columna | Tipo | Notas |
|---|---|---|
| `code` | TEXT | PK |
| `max_taxpayers` | INT | |
| `max_users` | INT | colaboradores; default 1 |
| `ai_included` | BOOLEAN | default `true` |

Sembrado por `prisma/seed.ts`: `STARTER` (1 contribuyente), `PROFESSIONAL`
(10), `ENTERPRISE` (100, 5 usuarios).

### `user_taxpayers`

Tabla de unión desde el día uno, aunque hoy cada contribuyente tiene
exactamente una fila ([ADR-003](adr/003-usuario-como-tenant-con-tabla-de-union.md)).
**Bajo RLS.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK |
| `taxpayer_id` | UUID | FK |
| `access` | ENUM | `OWNER` \| `COLLABORATOR`, default `OWNER` |
| `created_at` | TIMESTAMP | |

Único `(user_id, taxpayer_id)`.

---

## Contribuyentes y períodos

### `taxpayers`

**Bajo RLS.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `ruc` | TEXT | único |
| `business_name` | TEXT | |
| `trade_name` | TEXT | nullable |
| `regime` | ENUM | `RIMPE_POPULAR` \| `RIMPE_EMPRENDEDOR` \| `GENERAL`, default `GENERAL` |
| `iva_periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` \| `ANNUAL`, default `MONTHLY` — ingresado por el usuario, editable |
| `economic_activities` | JSONB | `[{code, description}]` |
| `activity_fingerprint` | TEXT | hash del conjunto de actividades |
| `created_by` | UUID | FK a `users` — no es parte del diseño original; ver nota abajo |
| `created_at` | TIMESTAMP | |

`activity_fingerprint` se recalcula al editar las actividades. Al cambiar,
las reglas de proveedor emitidas bajo el valor anterior quedan pendientes de
revalidación ([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)).

> **`created_by` no estaba en el diseño original.** Se agregó porque
> `Prisma.create()` siempre hace `INSERT ... RETURNING`, y Postgres filtra
> `RETURNING` por la política de `SELECT`: sin esta columna, el creador no
> podía ver la fila que acababa de insertar hasta que existiera el vínculo en
> `user_taxpayers` (que se crea en la sentencia siguiente, no en la misma) —
> en la práctica, nadie podía crear un contribuyente en absoluto. La política
> de `SELECT`/`UPDATE` acepta `created_by = usuario actual` además de la
> pertenencia vía `user_taxpayers`.

### `tax_periods`

**Bajo RLS.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `tax_type` | ENUM | `IVA` \| `INCOME_TAX` \| `WITHHOLDING`, default `IVA` — solo `IVA` tiene lógica implementada |
| `period_start`, `period_end` | DATE | |
| `periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` \| `ANNUAL`, default `MONTHLY` |
| `status` | ENUM | `DRAFT` \| `UNDER_REVIEW` \| `FILED` |
| `form_version_id` | UUID | FK, nullable — versión del formulario con la que se presentó |
| `proportionality_factor` | DECIMAL(5,4) | nullable hasta calcularse |
| `factor_inputs` | JSONB | nullable |
| `filed_at`, `locked_at` | TIMESTAMP | nullable |
| `created_at`, `updated_at` | TIMESTAMP | |

Único `(taxpayer_id, tax_type, period_start)`.

Un disparador en Postgres rechaza INSERT, UPDATE y DELETE sobre
`invoices_received`/`invoices_issued` del período mientras `locked_at` esté
fijado (`prisma/migrations/*_add_period_lock/`,
[ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

### `source_files`

**Bajo RLS.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `tax_period_id` | UUID | FK, nullable |
| `kind` | ENUM | `PURCHASES_TXT` \| `SALES_TXT` |
| `filename` | TEXT | |
| `sha256` | TEXT | detecta resubida del archivo idéntico |
| `row_count`, `rows_imported`, `rows_rejected` | INT | default 0 |
| `uploaded_by` | UUID | FK a `users` |
| `uploaded_at` | TIMESTAMP | |

---

## Comprobantes

### `invoices_received`

Refleja las columnas del archivo del SRI, sin inventar campos
([ADR-008](adr/008-solo-totales-sin-detalle-de-lineas.md)). **Bajo RLS.**

| Columna | Tipo | Origen / notas |
|---|---|---|
| `id` | UUID | |
| `taxpayer_id`, `tax_period_id` | UUID | FK |
| `source_file_id` | UUID | FK, nullable |
| `access_key` | CHAR(49) | `CLAVE_ACCESO` |
| `supplier_ruc` | TEXT | `RUC_EMISOR` |
| `supplier_name` | TEXT | `RAZON_SOCIAL_EMISOR` — señal principal de clasificación |
| `document_type` | TEXT | `TIPO_COMPROBANTE` |
| `series` | TEXT | `SERIE_COMPROBANTE` |
| `issue_date` | DATE | `FECHA_EMISION` — determina el período |
| `authorization_date` | TIMESTAMP | `FECHA_AUTORIZACION`, nullable |
| `subtotal` | DECIMAL(14,2) | `VALOR_SIN_IMPUESTOS`, tal cual |
| `vat_amount` | DECIMAL(14,2) | `IVA`, tal cual |
| `total` | DECIMAL(14,2) | `IMPORTE_TOTAL` |
| `modified_document` | TEXT | `NUMERO_DOCUMENTO_MODIFICADO`, nullable |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` \| `NOT_APPLICABLE` \| `UNCLASSIFIED` |
| `processing_status` | ENUM | `UNCLASSIFIED` \| `PROCESSED` \| `REQUIRES_MANUAL_REVIEW` \| `EXCLUDED` |
| `classification_source` | ENUM | `RULE` \| `CATALOG` \| `AI` \| `USER` \| `DETERMINISTIC`, nullable |
| `applied_rule_id` | UUID | nullable |
| `ai_confidence` | DECIMAL(3,2) | nullable |
| `ai_reasoning` | TEXT | nullable |
| `created_at`, `updated_at` | TIMESTAMP | |

Único `(taxpayer_id, access_key)` — la clave de deduplicación.

`iva_category = NOT_APPLICABLE` es el bucket de `IVA = 0`: no pasa por la
cascada. `processing_status` empieza en `UNCLASSIFIED` tras la ingesta;
`classifyPeriod()` lo mueve a `PROCESSED` o `REQUIRES_MANUAL_REVIEW`.

> **No se almacena ninguna base derivada.** `subtotal` y `vat_amount` son lo
> que trae el archivo.

### `invoices_issued`

El archivo de emitidas tiene **menos columnas** que el de recibidas: no trae
identificación del receptor ni razón social. **Bajo RLS.**

| Columna | Origen / notas |
|---|---|
| `id`, `taxpayer_id`, `tax_period_id`, `source_file_id` | igual que recibidas |
| `access_key` | `CLAVE_ACCESO` |
| `document_type` | `COMPROBANTE` (nótese: no `TIPO_COMPROBANTE`) |
| `series` | `SERIE_COMPROBANTE` |
| `issue_date`, `authorization_date` | `FECHA_EMISION` incluye hora aquí; en recibidas no |
| `subtotal`, `vat_amount`, `total` | tal cual |
| `sales_treatment` | ENUM: `TAXED` (automático) \| `ZERO_WITH_CREDIT` (405) \| `ZERO_NO_CREDIT` (403) \| `EXPORT_GOODS` (407) \| `EXPORT_SERVICES` (408) \| `NON_OBJECT_EXEMPT` (431) \| `UNCLASSIFIED` (inicial) |
| `created_at`, `updated_at` | |

Único `(taxpayer_id, access_key)`.

`sales_treatment` existe porque el archivo no dice a qué destino corresponde
una venta con `IVA = 0`. **Lo marca el usuario** en la pantalla de ventas
emitidas; el factor de proporcionalidad no se calcula mientras quede alguna
en `UNCLASSIFIED`.

---

## Motor de clasificación

### `supplier_rules`

La regla es por contribuyente, revocable, no se borra
([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)). **Bajo RLS.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `supplier_ruc` | TEXT | |
| `activity_fingerprint` | TEXT | contexto bajo el que se decidió |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` |
| `source` | ENUM | `USER` \| `CATALOG` \| `AI` |
| `created_by` | UUID | nullable si la creó el motor |
| `times_applied` | INT | default 0 |
| `revoked_at` | TIMESTAMP | nullable |
| `applied_at` | TIMESTAMP | |

### `shared_supplier_catalog`

Agregado global y anónimo. **Sin identificadores de contribuyentes ni
usuarios** ([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)). Sin
RLS. **No implementado todavía** — nivel 2 de la cascada pasa un arreglo
vacío (ver `docs/guides/code-flow.md`).

| Columna | Tipo |
|---|---|
| `supplier_ruc` | TEXT (PK) |
| `supplier_name` | TEXT |
| `suggested_iva_category` | ENUM |
| `agreement_ratio` | DECIMAL(3,2) |
| `sample_count` | INT, default 1 |
| `updated_at` | TIMESTAMP |

### `classification_events`

Append-only; un disparador rechaza `UPDATE` y `DELETE`
([ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)). **Bajo RLS**
(solo `SELECT`/`INSERT` — sin políticas de `UPDATE`/`DELETE`, reforzado
además por el disparador).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `received_invoice_id`, `issued_invoice_id` | UUID | FK, ambos nullable |
| `taxpayer_id`, `tax_period_id` | UUID | denormalizado para la bitácora |
| `field` | TEXT | qué cambió |
| `old_value`, `new_value` | TEXT | nullable |
| `actor_type` | ENUM | `USER` \| `ENGINE` |
| `actor_user_id` | UUID | nullable |
| `source` | ENUM | igual que `classification_source`, nullable |
| `rules_version`, `model_id`, `prompt_version` | TEXT | nullable |
| `reason` | TEXT | nullable |
| `created_at` | TIMESTAMP | |

Cubre tanto la clasificación de compras como el marcado de ventas y el
bloqueo/reapertura de período — `field` distingue el caso (`ivaCategory`,
`salesTreatment`, `status`).

---

## Datos normativos

### `tax_rates`

PK compuesta `(tax, valid_from)`. Sin RLS.

| Columna | Tipo |
|---|---|
| `tax` | ENUM (`IVA`) |
| `rate` | DECIMAL(5,4) |
| `valid_from`, `valid_to` | DATE, `valid_to` nullable |
| `source` | TEXT — de dónde viene el valor (CLAUDE.md → "Valores normativos") |
| `verified_at` | DATE — cuándo se verificó esa fuente |
| `created_by` | UUID → `users.id`, el admin que lo cargó |

**Vacía hoy.** Ningún valor en [`docs/tax/tasas-iva.md`](tax/tasas-iva.md)
está verificado todavía — CLAUDE.md prohíbe cargar un `[VERIFICAR]` de
memoria. `source`/`verified_at`/`created_by` se agregaron junto con la
pantalla de administración (`/admin/tasas`) — antes del 2026-10-04 el
esquema no tenía dónde registrar de dónde salía una tasa, aunque la regla
ya existía en CLAUDE.md.

### Formulario y relación con los resultados ([ADR-015](adr/015-definicion-del-formulario-desde-pdf.md))

El formulario es el **destino** de los resultados, no una fuente de cálculo.
Sin RLS (no es dato de contribuyente). La pantalla de administración
(`/admin/formularios`) existe desde el 2026-10-04 — **sigue vacía en
producción** hasta que un admin suba y publique un formulario real.

```
form_versions ──< form_fields
      └──────────< result_mappings ── (clave del resultado)
```

#### `form_versions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `form_code` | TEXT | `"104"`; el MVP solo soporta el mensual |
| `label` | TEXT | |
| `valid_from`, `valid_to` | DATE | los fija el administrador; `valid_to` nullable |
| `status` | ENUM | `DRAFT` \| `PUBLISHED` |
| `source_sha256` | TEXT | hash del PDF; el archivo no se guarda, nullable |
| `imported_by` | UUID | FK a `users` (ADMIN), nullable |
| `imported_at`, `published_at` | TIMESTAMP | nullable |

Único `(form_code, valid_from)`.

#### `form_fields`

El catálogo completo del formulario, tal como sale del PDF.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `form_version_id` | UUID | FK |
| `code` | TEXT | `"500"`, `"563"`… único por versión |
| `label` | TEXT | nombre oficial |
| `section` | TEXT | nullable |
| `column_kind` | ENUM | `GROSS` \| `NET` \| `TAX` \| `SINGLE`, default `SINGLE` |
| `display_order` | INT | |
| `observed` | BOOLEAN | default `true`; `false` si una importación posterior no lo encontró |

Único `(form_version_id, code)`. Sin valores, sin fórmulas, sin datos
personales.

#### `result_mappings`

PK compuesta `(form_version_id, result_key)`.

| Columna | Tipo | Notas |
|---|---|---|
| `form_version_id` | UUID | FK |
| `result_key` | TEXT | ej. `PURCHASES_WITH_CREDIT` |
| `form_field_id` | UUID | FK, nullable |
| `method` | ENUM | `ATTRIBUTES` \| `AI`, default `ATTRIBUTES` |
| `reason` | TEXT | explicación mostrada al usuario |
| `confidence` | DECIMAL(3,2) | nullable; solo cuando `method = AI` |
| `created_at` | TIMESTAMP | |

Único `(form_version_id, form_field_id)`. Nadie edita estas filas a mano.

#### `period_results`

PK compuesta `(tax_period_id, result_key)`.

| Columna | Tipo | Notas |
|---|---|---|
| `tax_period_id` | UUID | FK |
| `result_key` | TEXT | clave estable del dominio |
| `value` | DECIMAL(14,4) | 4 decimales por el factor (`1.0000`) |
| `computed_at` | TIMESTAMP | |

Lo que el dominio calculó. No conoce casilleros — la presentación une esto
con `result_mappings` de la versión guardada en `tax_periods`.

### `ai_usage`

PK compuesta `(user_id, taxpayer_id, period)`. Medición de consumo, no para
facturar ([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)). Sin RLS.
**Vacía hoy** — los niveles 2 y 3 de la cascada (catálogo compartido, IA) no
están implementados.

| Columna | Tipo |
|---|---|
| `user_id`, `taxpayer_id` | UUID |
| `period` | DATE |
| `calls`, `input_tokens`, `output_tokens` | INT, default 0 |

---

## Tablas bajo RLS

`taxpayers`, `user_taxpayers`, `tax_periods`, `source_files`,
`invoices_received`, `invoices_issued`, `supplier_rules`,
`classification_events`, `period_results`.

**Sin RLS** (no contienen datos de contribuyentes): `users`, `plans`,
`tax_rates`, `form_versions`, `form_fields`, `result_mappings`,
`shared_supplier_catalog`, `ai_usage`.

Cada tabla con RLS tiene tanto `ENABLE ROW LEVEL SECURITY` como
`FORCE ROW LEVEL SECURITY` — la app se conecta como el mismo rol (`taxap`)
que es dueño de las tablas, y sin `FORCE` Postgres lo exime de sus propias
políticas. Ver
[`prisma/migrations/*_add_rls/`](../prisma/migrations/) y
[ADR-004](adr/004-rls-por-usuario-con-prisma.md).
