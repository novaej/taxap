# Cómo funciona taxap

Recorrido real de un período, pantalla por pantalla, con las rutas y Server
Actions tal como existen en el código hoy. Para el porqué de cada decisión,
los ADRs enlazados — este documento describe el *qué*, no el *por qué*.

---

## Cuentas y acceso

NextAuth v5, correo y contraseña (`src/lib/auth.ts`), sesión JWT,
`bcryptjs` para el hash.

- **Registro** — `/[locale]/register` → `registerUser()` crea el usuario
  directamente contra `prisma` (la tabla `users` no tiene RLS). No crea
  ningún contribuyente.
- **Login** — `/[locale]/login`.
- **Protección de rutas** — `src/proxy.ts` redirige a `/login` cualquier
  ruta bajo `/periodos/` sin sesión. Next.js 16 renombró la convención de
  `middleware.ts` a `proxy.ts`; con un directorio `src/`, además, solo
  reconoce el archivo dentro de `src/`.

**No existe todavía** una pantalla de alta de contribuyente ni de selección
de período ([`NEXT_STEPS.md`](../../NEXT_STEPS.md)). El puente manual es
`scripts/seed-test-taxpayer.ts`.

## Acceso a datos

Toda consulta sobre tablas de contribuyentes pasa por `withUser(userId, fn)`
(`src/lib/db.ts`), que fija `app.current_user_id` con `SET LOCAL` dentro de
un único `$transaction` — nunca como dos llamadas sueltas, porque con un
pool de conexiones el `SET` y la consulta podrían caer en conexiones
distintas y la RLS se perdería en silencio. `asAdmin(fn)` existe para rutas
sin usuario (sembrado, tareas administrativas) y fija un id centinela
explícito, nunca `RESET` — una variable sin fijar debe fallar cerrado, no
abierto. Ver [ADR-004](../adr/004-rls-por-usuario-con-prisma.md).

## 1. Ingesta

**Ruta:** `/[locale]/(app)/[taxpayerId]/periodos/[periodId]/ingesta`
**Server Action:** `uploadSourceFiles()` (`ingesta/actions.ts`)
**Capas:** página → `services/ingestion` (parseo y validación) →
`domain/iva/access-key` (consistencia de la clave de acceso) → `withUser()`

Un archivo a la vez por ahora (el layout de carga múltiple del SRI —
`samples/`, un archivo por día — sigue pendiente de UI).

Por archivo:
1. Calcular `sha256` y detectar el formato por las columnas del encabezado
   (`detectFileType` — 12 columnas con `RUC_EMISOR` = recibidas, 8 con
   `COMPROBANTE` = emitidas). Ver
   [`../tax/formato-archivos-sri.md`](../tax/formato-archivos-sri.md).
2. Registrar en `source_files`.

Por fila (`ingestionService.validateReceivedRow`/`validateIssuedRow`):
1. Descomponer la `CLAVE_ACCESO` y contrastarla con fecha, tipo, RUC y serie
   ([ADR-009](../adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)).
2. Verificar que el comprobante pertenece al contribuyente del período
   (recibidos: `IDENTIFICACION_RECEPTOR`; emitidos: el RUC dentro de la
   clave).
3. Verificar que `FECHA_EMISION` cae dentro del período.
4. Verificar el tipo contra la lista blanca de
   `services/ingestion/ingestion-service.ts` →
   `VOUCHER_TYPE_WHITELIST` ([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)).
   Tipo desconocido → advertencia, no rechazo; cae a revisión manual en el
   paso de clasificación.
5. Insertar vía `upsert` sobre `(taxpayer_id, access_key)` — resubir el
   mismo archivo no duplica nada.

**Al terminar, los comprobantes quedan guardados con
`processing_status = UNCLASSIFIED`.** Si algo falla después, nada se pierde
([ADR-011](../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)).

## 2. Ventas emitidas

**Ruta:** `.../ventas`
**Server Actions:** `getPendingSales()`, `markSalesTreatment()`
(`ventas/actions.ts`)

El archivo de emitidos no distingue por qué una venta tiene `IVA = 0`
(exportación, 0% con o sin derecho a crédito, no objeto/exenta) ni trae
cliente o concepto. Esta pantalla es donde el usuario resuelve esa
ambigüedad.

- Ventas con `IVA > 0` quedan como `TAXED` automáticamente.
- Ventas con `IVA = 0` empiezan en `UNCLASSIFIED` y el usuario marca cada
  una (o varias a la vez) con su destino real. Cada marca llama a
  `markSalesTreatment()`, que actualiza `invoices_issued.sales_treatment` y
  escribe un evento en `classification_events`
  ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

El factor de proporcionalidad (pantalla de pre-declaración) no se calcula
mientras quede alguna venta `UNCLASSIFIED`.

## 3. Conciliación

**Ruta:** `.../conciliacion`
**Server Actions:** `getPurchasesByStatus()`, `classifyPeriod()`,
`applyManualClassification()` (`conciliacion/actions.ts`)

Solo entran aquí comprobantes con `IVA > 0`
([ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md)).

**`classifyPeriod()`** — paso 2 de la ingesta
([ADR-011](../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)): agrupa los
comprobantes `UNCLASSIFIED` por proveedor y corre la cascada de
`classificationCascade.classify()`
([ADR-005](../adr/005-clasificacion-en-cascada.md)):

```
┌─ Nivel 1 ── supplier_rules (contribuyente, proveedor) — no revocada
│             ↓ sin coincidencia
├─ Nivel 2 ── catálogo compartido (requiere 3+ de acuerdo) — []  aún no implementado, ADR-007
│             ↓ sin coincidencia
├─ Nivel 3 ── IA — null  aún no implementado, ADR-007
│             ↓ sin coincidencia
└─ Nivel 4 ── bandeja de revisión manual (processing_status = REQUIRES_MANUAL_REVIEW)
```

Un tipo de comprobante fuera de la lista blanca en el grupo manda todo el
proveedor a revisión manual sin pasar por la cascada
(`requiresManualReview()`, que toma el único booleano que ya calculó la
ingesta — no hay una segunda lista de "tipos estándar" por separado).

**`applyManualClassification()`** — clasificación manual, individual o en
bloque:
1. Actualiza `iva_category` y `processing_status = PROCESSED`.
2. Escribe un evento en `classification_events`.
3. Crea o actualiza la regla del proveedor (nivel 1) — el ciclo de
   retroalimentación: lo corregido hoy se aplica solo (sin IA) el período
   que viene.

## 4. Pre-declaración

**Ruta:** `/[locale]/(app)/[taxpayerId]/periodos/[periodId]` (la raíz del
período)
**Server Actions:** `computePeriodResults()`, `lockPeriod()`,
`reopenPeriod()` (`actions.ts` del período)

**`computePeriodResults()`** llama a `calculatePeriodResults()`
(`src/domain/iva/calculator.ts`) sobre los comprobantes del período — pura
lógica de dominio, sin SQL de agregación, probada sin base de datos
([ADR-001](../adr/001-nextjs-monolito-con-capa-de-dominio.md)) — y guarda
cada resultado en `period_results`. El dominio produce **claves estables**
(`SALES_TAXED`, `PURCHASES_WITH_CREDIT`, `PROPORTIONALITY_FACTOR`…) y no
conoce números de casillero
([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).

El factor de proporcionalidad
(`src/domain/iva/proportionality.ts`) cuenta exportaciones y ventas 0% con
derecho a crédito en el numerador; un contribuyente que solo exporta
servicios tiene factor `1.0000`
([`../tax/formulario-104.md`](../tax/formulario-104.md)). Se bloquea —con
una razón explícita, nunca un número inventado— si hay ventas sin marcar o
si no hay ventas en el período (denominador cero).

**La relación resultado → casillero del formulario (`result_mappings`,
ADR-015) no está implementada todavía:** la pantalla de administración que
importa el PDF y calcula esa relación no existe
([`NEXT_STEPS.md`](../../NEXT_STEPS.md)). Hoy la pantalla muestra las
claves del dominio directamente, no el casillero ni el nombre oficial del
campo.

**`lockPeriod()`** fija `tax_periods.status = FILED` y `locked_at`, y
escribe un evento. Un disparador en Postgres
(`prisma/migrations/*_add_period_lock/`) rechaza INSERT, UPDATE y DELETE
sobre `invoices_received`/`invoices_issued` del período mientras esté
bloqueado — vive en la base, no en la aplicación, para que ningún camino lo
sortee ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

**`reopenPeriod()`** limpia `status`/`locked_at` y también escribe un
evento — la reapertura en sí queda registrada, no solo lo que se edite
después.

## Pendiente de construir

Ver [`NEXT_STEPS.md`](../../NEXT_STEPS.md) para la lista completa. Lo más
relevante para entender el estado actual:

- Alta de contribuyente y selección de período (sin esto, no hay forma de
  usar la app sin `scripts/seed-test-taxpayer.ts`).
- Administración del formulario (ADR-015) — sin esto, `result_mappings`
  nunca se llena y la pre-declaración no muestra casilleros.
- Catálogo compartido (nivel 2) e IA (nivel 3) de la cascada de
  clasificación — hoy `classifyPeriod()` los pasa como vacíos/null; solo
  los niveles 1 y 4 están activos.
