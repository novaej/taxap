# Modelo de datos

Convenciones globales:

- **Claves primarias**: `UUID` con `DEFAULT uuid_generate_v7()`. Ordenan
  cronológicamente y no son enumerables.
- **Dinero**: `DECIMAL(14,2)`. Nunca `float`, nunca `number` de JavaScript.
  En TypeScript se maneja como `Prisma.Decimal`.
- **Fechas tributarias**: `DATE` sin zona horaria. Un comprobante emitido el
  31/08 es de agosto sin importar dónde esté el servidor.
- **Aislamiento**: RLS por `app.current_user_id`
  ([ADR-004](adr/004-rls-por-usuario-con-prisma.md)).

---

## Identidad y acceso

### `users`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `email` | TEXT | único |
| `password_hash` | TEXT | bcrypt |
| `first_name`, `last_name` | TEXT | |
| `role` | ENUM | `INDIVIDUAL` \| `ACCOUNTANT` \| `ADMIN`. **`ADMIN` es el administrador del sistema**: sube el formulario y las tasas. No es administrador de contribuyentes y no accede a sus datos |
| `plan` | ENUM | determina límites de contribuyentes y usuarios |
| `ai_enabled` | BOOLEAN | desactiva el nivel 3 de la cascada |
| `created_at` | TIMESTAMP | |

### `user_taxpayers`

Tabla de unión. Hoy cada contribuyente tiene exactamente una fila; existe para que
compartir acceso más adelante sea un `INSERT` y no una migración
([ADR-003](adr/003-usuario-como-tenant-con-tabla-de-union.md)).

| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | UUID | FK |
| `taxpayer_id` | UUID | FK |
| `access` | ENUM | `OWNER` \| `COLLABORATOR` |
| `created_at` | TIMESTAMP | |

PK compuesta `(user_id, taxpayer_id)`. Índice por `taxpayer_id` para la subconsulta de RLS.

### `plans`

| Columna | Tipo | Notas |
|---|---|---|
| `code` | TEXT | PK |
| `max_taxpayers` | INT | |
| `max_users` | INT | colaboradores; 1 en los planes actuales |
| `ai_included` | BOOLEAN | |

---

## Contribuyentes y períodos

### `taxpayers`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `ruc` | TEXT | 13 dígitos |
| `business_name` | TEXT | |
| `trade_name` | TEXT | nullable |
| `regime` | ENUM | `RIMPE_POPULAR` \| `RIMPE_EMPRENDEDOR` \| `GENERAL` |
| `iva_periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` — **ingresado por el usuario**, editable. El MVP solo genera pre-declaración para `MONTHLY` |
| `economic_activities` | JSONB | `[{code, description}]` |
| `activity_fingerprint` | TEXT | hash del conjunto de actividades |
| `created_at` | TIMESTAMP | |

`activity_fingerprint` se recalcula al editar las actividades. Al cambiar,
las reglas de proveedor emitidas bajo el valor anterior quedan pendientes de
revalidación ([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)).

### `tax_periods`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | FK |
| `tax_type` | ENUM | `IVA` \| `INCOME_TAX` \| `WITHHOLDING` — solo `IVA` en el MVP |
| `period_start`, `period_end` | DATE | reemplazan a mes/trimestre |
| `periodicity` | ENUM | `MONTHLY` \| `SEMIANNUAL` \| `ANNUAL` |
| `status` | ENUM | `DRAFT` \| `UNDER_REVIEW` \| `FILED` |
| `form_version_id` | UUID | FK — versión del formulario con la que se presentó el resultado |
| `proportionality_factor` | DECIMAL(5,4) | nullable hasta calcularse; `1.0000` es un valor normal, no un caso especial |
| `factor_inputs` | JSONB | los totales de ventas que lo produjeron |
| `filed_at`, `locked_at` | TIMESTAMP | nullable |

Único `(taxpayer_id, tax_type, period_start)`.

> No existe `quarter`. El calendario tributario ecuatoriano para IVA es mensual o
> semestral; Renta es anual.

### `source_files`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id`, `tax_period_id` | UUID | FK |
| `kind` | ENUM | `PURCHASES_TXT` \| `SALES_TXT` — extensible a XML |
| `filename` | TEXT | |
| `sha256` | TEXT | detecta resubida del archivo idéntico |
| `row_count`, `rows_imported`, `rows_rejected` | INT | |
| `uploaded_by` | UUID | FK a `users` |
| `uploaded_at` | TIMESTAMP | |

---

## Comprobantes

### `invoices_received`

Refleja las columnas del archivo del SRI, sin inventar campos que la fuente no trae.

| Columna | Tipo | Origen |
|---|---|---|
| `id` | UUID | |
| `taxpayer_id`, `tax_period_id`, `source_file_id` | UUID | |
| `access_key` | CHAR(49) | `CLAVE_ACCESO` |
| `supplier_ruc` | TEXT | `RUC_EMISOR` |
| `supplier_name` | TEXT | `RAZON_SOCIAL_EMISOR` |
| `document_type` | ENUM | `TIPO_COMPROBANTE` |
| `series` | TEXT | `SERIE_COMPROBANTE` |
| `issue_date` | DATE | `FECHA_EMISION` |
| `authorization_date` | TIMESTAMP | `FECHA_AUTORIZACION` |
| `subtotal` | DECIMAL(14,2) | `VALOR_SIN_IMPUESTOS` |
| `vat_amount` | DECIMAL(14,2) | `IVA` |
| `total` | DECIMAL(14,2) | `IMPORTE_TOTAL` |
| `modified_document` | TEXT | `NUMERO_DOCUMENTO_MODIFICADO`, nullable |
| **Clasificación** | | |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` \| `NOT_APPLICABLE` \| `UNCLASSIFIED` |
| `processing_status` | ENUM | `PROCESSED` \| `REQUIRES_MANUAL_REVIEW` \| `EXCLUDED` |
| `classification_source` | ENUM | `RULE` \| `CATALOG` \| `AI` \| `USER` \| `DETERMINISTIC` |
| `applied_rule_id` | UUID | nullable |
| `ai_confidence` | DECIMAL(3,2) | nullable |
| `ai_reasoning` | TEXT | nullable |

Único `(taxpayer_id, access_key)` — la clave de deduplicación.
Índices: `(taxpayer_id, tax_period_id, processing_status)`, `(taxpayer_id, supplier_ruc)`.

`iva_category = NOT_APPLICABLE` es el bucket de `IVA = 0`: no pasa por la cascada.

> **No se almacena ninguna base derivada.** `subtotal` y `vat_amount` son lo que
> trae el archivo. Ver [ADR-008](adr/008-solo-totales-sin-detalle-de-lineas.md).

### `invoices_issued`

El archivo de emitidas tiene **menos columnas** que el de recibidas: no trae
identificación del receptor ni razón social.

| Columna | Origen |
|---|---|
| `access_key` | `CLAVE_ACCESO` |
| `document_type` | `COMPROBANTE` (nótese: no `TIPO_COMPROBANTE`) |
| `series` | `SERIE_COMPROBANTE` |
| `issue_date`, `authorization_date` | |
| `subtotal`, `vat_amount`, `total` | |
| `sales_treatment` | Destino en el formulario: `TAXED` (IVA > 0, automático) \| `ZERO_WITH_CREDIT` (405) \| `ZERO_NO_CREDIT` (403) \| `EXPORT_GOODS` (407) \| `EXPORT_SERVICES` (408) \| `NON_OBJECT_EXEMPT` (431) \| `UNCLASSIFIED` (valor inicial de las de `IVA = 0`) |

Único `(taxpayer_id, access_key)`.

`sales_treatment` existe porque el archivo no dice a qué destino corresponde una
venta con `IVA = 0`, y de eso depende el factor de proporcionalidad. **Lo marca el
usuario** en una tabla tras la carga, una por una o en bloque; el factor no se
calcula mientras quede alguna en `UNCLASSIFIED`. Ver
[`tax/formulario-104.md`](tax/formulario-104.md) → *Decisiones tomadas*.

Las compras con `IVA = 0` tienen el mismo problema de destino (507, 508, 531, 532)
pero sin efecto sobre el crédito; el supuesto de trabajo está en *Decisiones
abiertas* del mismo documento.

---

## Motor de clasificación

### `supplier_rules`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `taxpayer_id` | UUID | la regla es **por contribuyente**, no global |
| `supplier_ruc` | TEXT | |
| `activity_fingerprint` | TEXT | contexto bajo el que se decidió |
| `iva_category` | ENUM | `CREDIT` \| `COST_EXPENSE` \| `NON_DEDUCTIBLE` |
| `source` | ENUM | `USER` \| `CATALOG` \| `AI` |
| `created_by` | UUID | nullable si la creó el motor |
| `times_applied` | INT | |
| `revoked_at` | TIMESTAMP | nullable — las reglas no se borran |

Único parcial `(taxpayer_id, supplier_ruc) WHERE revoked_at IS NULL`.

### `shared_supplier_catalog`

Agregado global y anónimo. **No contiene identificadores de contribuyentes ni de
usuarios** — solo el consenso sobre cada proveedor.

| Columna | Tipo |
|---|---|
| `supplier_ruc` | TEXT (PK) |
| `supplier_name` | TEXT |
| `suggested_iva_category` | ENUM |
| `agreement_ratio` | DECIMAL(3,2) |
| `sample_count` | INT |
| `updated_at` | TIMESTAMP |

### `classification_events`

Append-only, con trigger de inmutabilidad. `UPDATE` y `DELETE` se rechazan.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `received_invoice_id`, `issued_invoice_id` | UUID | FK; `CHECK` exactamente uno no nulo. La bitácora cubre compras y también el marcado de ventas |
| `field` | TEXT | qué cambió |
| `old_value`, `new_value` | TEXT | |
| `actor_type` | ENUM | `USER` \| `ENGINE` |
| `actor_user_id` | UUID | nullable |
| `source` | ENUM | igual que `classification_source` |
| `rules_version` | TEXT | versión del motor determinista |
| `model_id`, `prompt_version` | TEXT | nullable, solo cuando `source = AI` |
| `reason` | TEXT | |
| `created_at` | TIMESTAMP | |

Esta tabla es la respuesta a *"¿por qué este comprobante se clasificó así?"* dos
años después. Ver [ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md).

---

## Datos normativos

Versionados por vigencia, nunca constantes en el código
([ADR-012](adr/012-tasas-y-casilleros-como-datos-con-vigencia.md)).

### `tax_rates`

| Columna | Tipo |
|---|---|
| `tax` | ENUM (`IVA`) |
| `rate` | DECIMAL(5,4) |
| `valid_from`, `valid_to` | DATE |

### Formulario y relación con los resultados

El formulario es el **destino** de los resultados, no una fuente de cálculo. Un
administrador sube el PDF una vez; el sistema guarda el catálogo completo de campos y
relaciona cada resultado con el campo que le corresponde
([ADR-015](adr/015-definicion-del-formulario-desde-pdf.md)).

```
form_versions ──< form_fields
      └──────────< result_mappings ── (clave del resultado)
```

#### `form_versions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `form_code` | TEXT | `104`. El MVP solo soporta el mensual; el semestral es otro formulario |
| `label` | TEXT | ej. "Declaración de IVA" |
| `valid_from`, `valid_to` | DATE | **los fija el administrador**; el PDF no lo dice |
| `status` | ENUM | `DRAFT` \| `PUBLISHED` |
| `source_sha256` | TEXT | hash del PDF importado; el archivo **no se guarda** |
| `imported_by` | UUID | FK a `users` (ADMIN) |
| `imported_at`, `published_at` | TIMESTAMP | |

Una versión publicada que algún período ya usó **no se modifica**.

#### `form_fields`

El catálogo **completo** del formulario, tal como sale del PDF.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `form_version_id` | UUID | FK |
| `code` | TEXT | `500`, `563`… único por versión |
| `label` | TEXT | nombre oficial, tal como se mostrará al usuario |
| `section` | TEXT | ej. "Resumen de adquisiciones y pagos" |
| `column_kind` | ENUM | `GROSS` \| `NET` \| `TAX` \| `SINGLE` |
| `display_order` | INT | |
| `observed` | BOOLEAN | `false` si una importación posterior no lo encontró |

Único `(form_version_id, code)`. **Sin valores, sin fórmulas y sin datos personales.**

#### `result_mappings`

Qué campo recibe cada resultado del dominio. Lo calcula el sistema **una vez por versión
del formulario** y queda guardado, de modo que un resultado siempre cae en el mismo
casillero.

| Columna | Tipo | Notas |
|---|---|---|
| `form_version_id` | UUID | FK |
| `result_key` | TEXT | ej. `PURCHASES_WITH_CREDIT`, con su parte `.GROSS` / `.NET` / `.TAX` |
| `form_field_id` | UUID | FK |
| `method` | ENUM | `ATTRIBUTES` (coincidencia determinista) \| `AI` |
| `reason` | TEXT | **explicación de por qué se ubicó ahí**, que se muestra al usuario |
| `confidence` | DECIMAL(3,2) | nullable; solo cuando `method = AI` |
| `created_at` | TIMESTAMP | |

PK `(form_version_id, result_key)`; único `(form_version_id, form_field_id)`.

Un resultado **sin fila** no tiene casillero identificado: se muestra sin código y se
avisa. No bloquea nada. Nadie edita estas filas a mano: si una relación no es la
esperada, se corrige mejorando las reglas de emparejamiento. Al publicar una versión
nueva, se conservan las relaciones cuyo campo no cambió y se recalculan las demás.

Cada resultado del dominio lleva una **descripción estructurada** (operación,
tratamiento, columna, activo fijo) que es lo que el sistema compara con los nombres de
`form_fields`. El catálogo de claves vive en el dominio (`src/domain/`); ver
[`tax/formulario-104.md`](tax/formulario-104.md) para los resultados del MVP y el
casillero que se espera para cada uno.

#### `period_results`

Lo que el dominio calculó para un período. **No conoce casilleros**: la presentación
une estas filas con `result_mappings` de la versión guardada en `tax_periods`.

| Columna | Tipo | Notas |
|---|---|---|
| `tax_period_id` | UUID | FK |
| `result_key` | TEXT | |
| `value` | DECIMAL(14,4) | 4 decimales por el factor (`1.0000`) |
| `computed_at` | TIMESTAMP | |

PK `(tax_period_id, result_key)`. Se recalculan a partir de los comprobantes; se
guardan para fijar lo que el usuario vio al cerrar el período.

Las tasas y las versiones del formulario son de solo lectura para el usuario, pero
**visibles**: debe poder verificar qué tasa y qué formulario usó el sistema en su
período.

### `ai_usage`

Medición de consumo para detectar abuso, **no para facturar**
([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)).

| Columna | Tipo |
|---|---|
| `user_id`, `taxpayer_id` | UUID |
| `calls`, `input_tokens`, `output_tokens` | INT |
| `period` | DATE |

---

## Tablas bajo RLS

`taxpayers`, `user_taxpayers`, `tax_periods`, `source_files`,
`invoices_received`, `invoices_issued`, `supplier_rules`, `classification_events`,
`period_results`.

**Sin RLS** (no contienen datos de contribuyentes): `users`, `plans`, `tax_rates`,
`form_versions`, `form_fields`, `result_mappings`, `shared_supplier_catalog`.
