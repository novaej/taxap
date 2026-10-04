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
- **Login** — `/[locale]/login`, `signIn()` de `next-auth/react` desde el
  cliente.
- **Logout** — botón al fondo de `AppSidebar`
  (`src/components/logout-button.tsx`), visible en toda la aplicación,
  `signOut()` de `next-auth/react`.
- **Protección de rutas** — `src/proxy.ts` es una lista blanca, no una
  lista negra: toda ruta exige sesión salvo `/login`, `/register` y la
  portada (`/`, que solo redirige). Así una pantalla nueva queda protegida
  por defecto sin que alguien tenga que acordarse de agregarla a una lista.
  Next.js 16 renombró la convención de `middleware.ts` a `proxy.ts`; con un
  directorio `src/`, además, solo reconoce el archivo dentro de `src/`.
- **Rol** — `users.role` (`INDIVIDUAL | ACCOUNTANT | ADMIN`) viaja en el
  JWT de sesión (`src/lib/auth.ts`, callbacks `jwt`/`session`) para que el
  sidebar sepa si mostrar el enlace de administración sin una consulta
  aparte. **Nunca se usa ese claim para autorizar una acción real** — un
  JWT es de larga duración y podría seguir diciendo `ADMIN` después de
  que alguien pierda el rol; `requireAdmin()` (`src/lib/session.ts`)
  vuelve a consultar `users` directo antes de dejar pasar cualquier
  Server Action de `/admin`.

## Navegación

Dos layouts anidados bajo `(app)`, más un componente de barra lateral:

- **`AppSidebar`** (`src/components/app-sidebar.tsx`, cliente) — montado
  por `(app)/layout.tsx`, envuelve todas las pantallas autenticadas.
  Siempre visible en escritorio (`md:block`); en móvil es un panel
  deslizante con botón de hamburguesa (`useState` local, sin librería de
  estado). Enlaces: "Mis contribuyentes" siempre, "Administración" solo
  si `session.user.role === 'ADMIN'`. Resalta la sección activa comparando
  `usePathname()`.
- **`[taxpayerId]/layout.tsx`** — envuelve todo lo que cuelga de un
  contribuyente (`periodos`, `editar`). Franja secundaria: razón social +
  dos botones de icono ("Períodos" = `Calendar`, "Editar contribuyente" =
  `SquarePen`, cada uno con `title`/`aria-label` ya que no llevan texto
  visible). Llama a `getTaxpayer()` una vez por request; cada página hija
  puede volver a consultarlo si necesita más que el nombre (no hay
  memoización entre layout y página todavía).

Las tarjetas de `/taxpayers` y de `/[taxpayerId]/periodos` siguen el
mismo patrón: un `<Link>` envuelve el nombre/ícono (navegación principal,
un clic entra al contribuyente o al período) y los controles secundarios
—botones de icono para editar, un `Select` o un botón de borrar— quedan
como hermanos del `<Link>` dentro del mismo `CardHeader`, nunca anidados
dentro de él (un `<button>` dentro de un `<a>` es HTML inválido y rompe
el foco de teclado).

**Modales en vez de formularios inline** — crear un período
(`periodos-client.tsx`), una versión de formulario y agregar un casillero
(`admin/formularios/...`), y cargar una tasa de IVA (`admin/tasas/...`)
usan `src/components/ui/dialog.tsx` (envoltorio de `radix-ui`'s `Dialog`,
primer uso en el proyecto). Se eligió modal sobre página completa para
las acciones cortas de un formulario pequeño que no necesitan su propia
URL; el alta/edición de contribuyente sigue siendo página completa porque
tiene demasiados campos (actividades económicas de largo variable) para
un modal.

Dentro de un período, las cuatro pantallas (`ingesta`, `ventas`,
`conciliacion`, la raíz de pre-declaración) comparten
`period-step-nav.tsx`: una barra de pestañas con los cuatro pasos en
orden, el actual resaltado, cada uno un enlace directo a los otros tres.
Reemplaza al enlace único "← Volver" que existía antes — ese enlace solo
permitía retroceder un nivel, y **la raíz del período no tenía ningún
enlace hacia las otras tres pantallas**: una vez creado un período, no
había forma de llegar a ingesta/ventas/conciliación sin escribir la URL a
mano. La barra de pasos no vive en ningún layout porque las cuatro rutas
no comparten un segmento común en el árbol de Next.js (`periodId` está
bajo `periodos/`, pero `ingesta`/`ventas`/`conciliacion` son hermanos de
la raíz del período, no hijos suyos) — cada página la importa y la
renderiza por su cuenta.

## 0. Contribuyentes y períodos

**Rutas:** `/[locale]/(app)/taxpayers`, `/[locale]/(app)/taxpayers/new`,
`/[locale]/(app)/[taxpayerId]/editar`, `/[locale]/(app)/[taxpayerId]/periodos`
**Server Actions:** `getMyTaxpayers()`, `createTaxpayer()`
(`taxpayers/actions.ts`); `getTaxpayer()`, `updateTaxpayer()`
(`[taxpayerId]/actions.ts`); `getTaxpayerPeriods()`, `createPeriod()`,
`updatePeriodStatus()`, `deletePeriod()` (`[taxpayerId]/periodos/actions.ts`)

La portada (`/[locale]`) redirige: con sesión a `/taxpayers`, sin sesión a
`/login`. Ya no hay rutas de demostración con ids fijos.

- `/taxpayers` lista los contribuyentes del usuario (vía `user_taxpayers`,
  filtrado por RLS) y lleva a `/taxpayers/new`, `/[taxpayerId]/periodos` o
  `/[taxpayerId]/editar`.
- `createTaxpayer()`/`updateTaxpayer()` calculan `activityFingerprint` con
  `computeActivityFingerprint()` (`domain/iva/activity-fingerprint.ts` —
  hash de las actividades económicas ordenadas, ADR-006) cada vez que se
  guardan actividades. **La revalidación de `supplier_rules` cuando cambia
  la huella (ADR-006) no está implementada** — el campo se recalcula y se
  guarda, nada más. Un RUC duplicado devuelve `RUC_IN_USE` en ambas
  acciones, no una excepción sin manejar. El formulario (`taxpayer-form.tsx`,
  compartido entre alta y edición) no deja editar el RUC más allá de la
  validez del formato; si cambia, se vuelve a chequear unicidad excluyendo
  al propio contribuyente.
- `/[taxpayerId]/periodos` lista los períodos del contribuyente y permite
  crear uno nuevo (año + mes → `periodStart`/`periodEnd`, mensual e IVA por
  ahora). La restricción de unicidad real es
  `(taxpayerId, taxType, periodStart)`, no año/mes como tales.
  - **Cambiar de estado** (`updatePeriodStatus`) solo mueve
    `DRAFT ↔ UNDER_REVIEW` y escribe un evento en `classification_events`
    (ADR-013, regla 6). `FILED` queda fuera a propósito — es
    `lockPeriod()`/`reopenPeriod()` (pantalla de pre-declaración, ver
    sección 4) porque esos dos además fijan/limpian `locked_at`, que
    dispara el candado de comprobantes de Postgres.
  - **Borrar un período** (`deletePeriod`) solo funciona en `DRAFT` y sin
    comprobantes (`invoices_received`/`invoices_issued` en cero) — si
    cualquiera de las dos condiciones falla, devuelve `NOT_DRAFT` o
    `HAS_DATA` sin tocar nada. Es la única vía de borrado que existe sobre
    un período; no hay equivalente para un contribuyente (ver más abajo).

**Los contribuyentes no se pueden borrar.** La tabla `taxpayers` solo tiene
políticas RLS de `SELECT`/`INSERT`/`UPDATE` — ningún `DELETE`, ni siquiera
para `is_system_admin()`. Con `FORCE ROW LEVEL SECURITY`, la ausencia de una
política para un comando bloquea ese comando por completo, no solo lo
filtra. Es deliberado (coherente con la bitácora inmutable de ADR-013): si
se necesita en el futuro, es una decisión de producto nueva, no un `DELETE`
que falte agregar. `classification_events` va un paso más allá: un
disparador en Postgres rechaza `DELETE`/`UPDATE` sobre esa tabla
incondicionalmente, para cualquier rol, superusuario incluido — no es RLS
(que el superusuario sí ignora), es un trigger real. Cualquier período con
al menos un evento (cualquier transición de estado) queda permanentemente
imborrable, y con él su contribuyente. Ver
[`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md).

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

**Esta ruta no siempre muestra resultados.** `page.tsx` cuenta
`invoices_received` + `invoices_issued` del período; en cero, renderiza
`PeriodOverview` (`period-overview.tsx`) en vez de
`PreDeclaracionClient` — cuatro tarjetas grandes, una por paso del flujo,
la primera ("Ingesta") marcada como punto de partida. Antes de esto, un
período recién creado caía directo en una vista de resultados vacíos con
el factor bloqueado, que se leía como roto, no como vacío. En cuanto el
período tiene al menos un comprobante, vuelve a mostrar la vista de
resultados de siempre.

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
después. Expuesta en la UI (`predeclaracion-client.tsx`) como el botón
"Reabrir período", visible solo cuando `isFiled` — antes existía la
función pero no había botón que la llamara.

## 5. Administración

**Rutas:** `/[locale]/(app)/admin/formularios`,
`/[locale]/(app)/admin/formularios/[formVersionId]`,
`/[locale]/(app)/admin/tasas`
**Server Actions:** todas en `admin/actions.ts`, todas detrás de
`requireAdmin()`, todas corriendo con `asAdmin()` — nunca `withUser()`,
porque el admin no es dueño de ningún contribuyente ([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).

El admin es del sistema: sube/publica el formulario y carga tasas, pero
no ve datos de contribuyentes ni interviene en resultados — el disclaimer
de `admin/layout.tsx` lo dice explícitamente en la pantalla.

- **`createFormVersionDraft()`** sube un PDF, calcula su `sha256`
  (`crypto`, igual que `uploadSourceFiles()` en ingesta) y crea un
  `FormVersion` en `DRAFT`. **El PDF no se guarda en ningún punto** — ni
  el archivo ni su contenido, solo el hash, tal como exige ADR-015.
  También intenta extraer sus casilleros con
  `extractCandidateFields()` (`src/services/forms/pdf-field-extractor.ts`,
  pura, sin I/O — recibe el texto ya extraído por `pdf-parse` como
  string): heurística de texto plano, sin datos de posición/layout real
  detrás, así que acierta el caso común (código + nombre + bruto/neto/
  impuesto en una sola línea) y falla de forma predecible en el resto
  (líneas envueltas, fórmulas impresas en la propia celda como
  "482-484"). Deliberadamente conservadora con cuánto texto atrás toma
  como nombre del campo (como mucho 2 líneas) — el motivo no es solo
  precisión: las primeras líneas de cada página repiten la identidad del
  contribuyente (RUC, razón social) y una ventana de búsqueda más larga
  la metía directo en `form_fields.label` en pruebas reales contra el
  PDF de muestra. Un PDF escaneado sin capa de texto, o cualquier fallo
  de lectura, deja el borrador sin casilleros — nunca un error duro.
  Todas las filas, generadas o no, quedan editables y borrables en la
  pantalla siguiente antes de publicar (ADR-015: la revisión del admin
  nunca es opcional, la calidad de la extracción no cambia eso).
- **`addFormField()`** agrega un casillero (código, nombre oficial,
  sección, tipo de columna) a mano, uno por uno, mientras la versión
  esté en `DRAFT`. El propio esquema (`@@unique([formVersionId, code])`)
  rechaza un código repetido — `addFormField` atrapa ese error de
  Postgres y lo traduce a `DUPLICATE_CODE`, no hay revalidación de
  duplicados en la aplicación porque la base ya lo garantiza.
- **`publishFormVersion()`** exige al menos un casillero y fija
  `status = PUBLISHED` + `publishedAt`. Una vez publicada, la versión no
  se edita — la UI deja de mostrar los controles de agregar/quitar
  casillero. Corregir algo es una versión nueva, no una edición
  (mismo principio que los ADRs: nunca se reescribe, se reemplaza).
- **`createTaxRate()`** exige `source` y `verifiedAt` en el propio
  formulario — no se puede enviar sin ambos (CLAUDE.md → "Valores
  normativos"). **No hay ninguna tasa cargada**: ninguna fila de
  [`docs/tax/tasas-iva.md`](../tax/tasas-iva.md) está verificada todavía,
  así que `/admin/tasas` existe pero su tabla sigue vacía en cualquier
  entorno real.
- **`result_mappings` no se calcula en ningún punto todavía** — la
  cascada de 4 niveles de ADR-015 (versión anterior → atributos → IA →
  sin casillero) no está implementada. Publicar un formulario deja sus
  `form_fields` listos, pero nada los conecta todavía con las claves de
  resultado del dominio (`NEXT_STEPS.md`).

## Pendiente de construir

Ver [`NEXT_STEPS.md`](../../NEXT_STEPS.md) para la lista completa. Lo más
relevante para entender el estado actual:

- Extracción automática del PDF y cálculo de `result_mappings`
  (ADR-015) — sin esto, la pre-declaración sigue sin mostrar casilleros
  aunque ya exista un formulario publicado.
- Catálogo compartido (nivel 2) e IA (nivel 3) de la cascada de
  clasificación — hoy `classifyPeriod()` los pasa como vacíos/null; solo
  los niveles 1 y 4 están activos.
