# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Modo imperativo: "Agregar", no "Agregado".

## [Sin publicar]

### Agregado
- `docs/site/screens/`: especificaciones de ingesta, ventas emitidas, conciliación,
  pre-declaración y administración del formulario — el contrato de cada pantalla
  antes de construirla
- Base documental del proyecto: README, GETTING_STARTED, CLAUDE.md, NEXT_STEPS
- 14 ADRs con las decisiones de arquitectura del MVP
- `docs/mvp-scope.md` con alcance y criterios de aceptación
- `docs/data-model.md` con el esquema comentado
- `docs/tax/formato-archivos-sri.md` verificado contra archivos reales del SRI
- `docs/tax/tasas-iva.md` y `docs/tax/formulario-104.md` como andamiaje pendiente
  de verificación normativa
- ADR-015: el sistema conoce el formulario 104 (catálogo completo importado desde un PDF
  que no se guarda) y relaciona cada resultado con su casillero por significado
- `docs/tax/formulario-104.md`: catálogo de casilleros verificado contra un formulario
  real, con los resultados del MVP y el casillero esperado de cada uno
- Tablas `form_versions`, `form_fields`, `result_mappings` y `period_results` en el
  modelo de datos

### Cambiado
- **El formulario 104 es el destino de los resultados, no una fuente de cálculo.** El
  dominio produce resultados con clave estable y no conoce números de casillero. Las
  fórmulas impresas del formulario quedan en `formulario-104.md` como referencia para
  quien implementa el dominio; el sistema no las lee ni las ejecuta.
- **Importación del formulario.** El administrador sube el PDF una vez; se guarda el
  catálogo completo de campos (código, nombre, sección) y nada más: ni el PDF, ni
  valores, ni datos personales. El sistema relaciona cada resultado con su campo en
  cascada (relación guardada → coincidencia por atributos → IA opcional → sin casillero)
  y guarda la relación por versión del formulario, junto con la razón por la que se ubicó ahí. El administrador es del sistema y no corrige relaciones.
- **Alcance del formulario reducido a lo básico de ventas y compras.** Fuera: liquidación,
  saldos de crédito anteriores (605) y total a pagar.
- **Ventas con `IVA = 0`: las marca el usuario** en una tabla tras la carga. El factor no
  se calcula mientras haya ventas sin marcar. La bitácora cubre también este marcado.
- **Compras con `IVA = 0` sin decisión por comprobante**: un total informativo con un
  casillero aproximado sugerido.
- **Se elimina `attribution`.** La clasificación de una compra es 500 o 502.
- **El MVP se limita al formulario mensual.** El semestral pasa a `NEXT_STEPS.md`.

### Corregido
- **Factor de proporcionalidad.** Se había documentado que con ventas sin IVA el
  factor es cero. Es incorrecto: exportaciones y ventas 0% con derecho a crédito
  suman al numerador (`1.0000` para quien solo exporta servicios). Corregido en
  `mvp-scope.md`, `code-flow.md`, `formato-archivos-sri.md` y `CLAUDE.md`.
- ADR-008 y ADR-010 anotados: `IVA = 0` sin decisión aplica a compras, no a ventas;
  los comprobantes de retención podrían alimentar el 609.
- **`docker-compose.yml` eliminado.** El desarrollo local usa un contenedor
  `postgres18` administrado a mano (`docker start` / `docker run` +
  `scripts/setup-db.sh`), no `docker compose up`. ADR-002 todavía nombra
  `docker-compose.yml` como el mecanismo elegido — sigue pendiente un ADR nuevo
  que lo reemplace formalmente; por ahora `docs/LOCAL-DEVELOPMENT.md` es la
  fuente de verdad para el flujo real.
- **`GETTING_STARTED.md` desactualizado.** Decía PostgreSQL 16+ (es 18+), y
  listaba `npm run migrate` y `npm run test:rls`, que no existen (el script real
  es `db:migrate`; no hay todavía un test de aislamiento RLS permanente).
  Corregido para reflejar los pasos que de verdad funcionan hoy.
- **RLS no filtraba nada, en silencio.** La migración de RLS
  (`20260924062837_add_rls`) tenía dos fallos: políticas contra columnas
  `snake_case` que no existen (el esquema no tiene `@map`, son `camelCase`), y sin
  `FORCE ROW LEVEL SECURITY` el rol `taxap` —dueño de las tablas— quedaba exento de
  sus propias políticas. Ninguno de los dos producía un error visible. Corregido y
  verificado manualmente contra la base real. Ver
  [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md), `NEXT_STEPS.md` y
  `CLAUDE.md` → "Errores fáciles de cometer aquí".

### Auditoría de documentación
- Revisados los 32 archivos `.md` del repositorio contra el estado real del código.
  Los ADR y `docs/tax/` están al día. Los specs pre-código
  (`data-model.md`, `mvp-scope.md`, `code-flow.md`, `coding-guidelines.md`,
  `docs/site/screens/`) describían un diseño más elaborado que lo construido —
  reconciliado el 2026-09-30, ver más abajo.

## [2026-09-30] Reconciliación del código con los specs pre-código

### Agregado
- Esquema de Prisma reescrito para seguir `docs/data-model.md`: `id` con
  `uuidv7()` nativo (PostgreSQL 18, sin extensión) en vez de `cuid()`; cada
  columna mapeada a `snake_case` vía `@map`; tablas `plans` y `ai_usage`;
  campos que faltaban en `taxpayers`, `tax_periods`, `invoices_received`,
  `invoices_issued`, `supplier_rules`. `taxpayers.created_by` se agregó sin
  estar en el spec — necesario para que Prisma pueda crear un contribuyente
  en absoluto (ver Corregido).
- `scripts/db-reset.ts` (`npm run db:reset`), modelado en `comprobify/db/reset.js`:
  bloqueado en producción, borra tablas/tipos/funciones de `public` y vuelve a
  aplicar las migraciones.
- Enrutado movido a `src/app/[locale]/(app)/[taxpayerId]/periodos/[periodId]/...`
  con `next-intl` (`messages/es.json`) y Server Actions, reemplazando las rutas
  planas y las API routes REST.
- Tailwind 4 + shadcn/ui (`components.json`, `src/components/ui/`) en vez de
  estilos inline.

### Corregido
- **RLS, dos fallos más** además de los ya corregidos el 2026-09-24 (ver
  entrada de ese día): `INSERT ... RETURNING` de Prisma —que `.create()`
  siempre usa— se filtra por la política de `SELECT`, así que nadie podía
  crear un contribuyente hasta agregar `taxpayers.created_by`. Y el propio
  ejemplo de política en ADR-004 hace *bypass* cuando la variable de sesión
  está simplemente sin fijar, indistinguible de una consulta que alguien
  olvidó envolver en `withUser()` — corregido con un id centinela que
  `asAdmin()` debe fijar a propósito. Ver la nota de actualización agregada a
  ADR-004 y CLAUDE.md → "Errores fáciles de cometer aquí".
- **`SALES_NON_OBJECT_EXEMPT`** (encontrado en la auditoría del 2026-09-26,
  sin corregir entonces): agregado a `RESULT_KEYS` y `calculator.ts`.
- **`file-parser.ts` no coincidía con el formato verificado.** Columnas
  inventadas (`DESCUENTO`, `ESTADO`, `NUMERO_COMPROBANTE`), faltaba
  `RAZON_SOCIAL_EMISOR`. Arrastraba dos bugs: `ingestion-service.ts` verificaba
  la consistencia de la clave de acceso contra la columna equivocada
  (`COMPROBANTE`, el tipo de comprobante, en vez de `SERIE_COMPROBANTE`), y
  `parseDate` no recortaba la hora de `FECHA_EMISION` en emitidas, invalidando
  la fecha en silencio.
- `requiresManualReview` tenía una segunda lista de tipos de comprobante
  "estándar" que no coincidía con la lista blanca real de `ingestion-service.ts`
  (ADR-010) — dos fuentes de verdad para la misma decisión. Unificado a una sola.

### Sin decidir
- `docs/guides/coding-guidelines.md` pide SQL crudo para el factor de
  proporcionalidad; el dominio lo calcula en TypeScript puro, que es lo que
  ADR-001 pide para probar el motor sin base de datos. La guía quedó sin
  corregir — ver `NEXT_STEPS.md`.

## [2026-10-01] Autenticación conectada

### Agregado
- NextAuth v5 con proveedor `Credentials` (correo + contraseña, `bcryptjs`,
  sesión JWT) — `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`.
  `src/lib/session.ts` da un `getCurrentUserId()` compartido que reemplaza el
  stub que cada `actions.ts` tenía por separado.
- Pantallas `/login` y `/register` (`src/app/[locale]/(auth)/`).
- `src/proxy.ts` redirige a `/login` cualquier ruta bajo `/periodos/` sin
  sesión.
- `prisma/seed.ts`: siembra los planes (`plans`) — no existía, pese a que
  `package.json` ya apuntaba `db:seed` a ese archivo. `db:reset` ahora lo
  corre automáticamente al final.

### Corregido
- **El registro no podía completarse nunca.** `users.plan_code` es una FK a
  `plans.code`, y no había ninguna fila en `plans`. Resuelto por el seed
  nuevo.
- **El middleware de autenticación no se ejecutaba.** Dos causas, ambas
  silenciosas (no había ningún error, la ruta protegida simplemente
  renderizaba sin redirigir): `middleware.ts` estaba en la raíz del proyecto,
  pero con un directorio `src/` Next.js solo lo reconoce en
  `src/middleware.ts`; y Next.js 16 renombró todo el mecanismo a `proxy.ts`
  (`middleware.ts` queda deprecado). Movido a `src/proxy.ts` con la función
  exportada como `proxy`.

Verificado end-to-end contra la base real: registro, login vía el endpoint
real de NextAuth (`/api/auth/callback/credentials`), sesión con `user.id`
poblado, y las cuatro pantallas de período respondiendo 200 con un
contribuyente y un período creados a mano para la prueba (todavía no hay
pantalla de alta de contribuyente — ver `NEXT_STEPS.md`).

## [2026-10-02] Bloqueo de período (ADR-013, segundo mecanismo)

### Agregado
- Disparador en `invoices_received`/`invoices_issued`
  (`prisma/migrations/20261001000000_add_period_lock/`) que rechaza INSERT,
  UPDATE y DELETE cuando `tax_periods.locked_at` está fijado. Vive en
  Postgres, como el de inmutabilidad de `classification_events`, para que
  ninguna consulta administrativa lo sortee. Verificado contra la base real:
  las tres operaciones se bloquean con el período cerrado y funcionan de
  nuevo tras reabrirlo.

### Corregido
- `lockPeriod()` y `reopenPeriod()` no registraban ningún evento. ADR-013
  exige explícitamente que la reapertura quede registrada. Ambas acciones
  ahora escriben un evento en `classification_events`.

### Verificado (sin cambios de código)
- El bloqueo del factor de proporcionalidad cuando no hay ventas
  (denominador cero) ya estaba resuelto en `proportionality.ts` —
  `NEXT_STEPS.md` lo tenía listado como pendiente por error. Lo único que
  sigue abierto es una pregunta externa (qué espera el portal del SRI en el
  563 en ese caso), ya marcada `[VERIFICAR]` en `formulario-104.md`.

## [2026-10-02] Documentación: de specs pre-código a documentación de lo real

Con el MVP funcionando de principio a fin, los documentos escritos *antes*
de que existiera código dejaron de ser la referencia correcta -- describían
una intención, no lo construido, y habían divergido en varios puntos reales
(convenciones de esquema, rutas, Server Actions vs. API routes REST). Esta
entrada reemplaza esos documentos por otros que describen lo que la app
hace hoy.

### Eliminado
- `docs/mvp-scope.md` — criterios de aceptación pre-construcción; su
  contenido vigente ya vive en `README.md` (qué hace) y `NEXT_STEPS.md`
  (qué queda fuera).
- `docs/site/screens/` (5 specs + README) — contratos de pantalla
  "antes de construirla". Reemplazados por
  `docs/guides/code-flow.md`, que describe las rutas, Server Actions y
  comportamiento reales de las cuatro pantallas construidas.
- `docs/LOCAL-DEVELOPMENT.md` — fusionado en `GETTING_STARTED.md`. Tener dos
  documentos de arranque fue la causa raíz del bug de `docker-compose.yml`
  corregido el 2026-09-24; un solo archivo de inicio rápido evita que vuelva
  a pasar.

### Cambiado
- `docs/guides/code-flow.md` reescrito por completo: recorrido real de las
  cuatro pantallas (ingesta, ventas emitidas, conciliación,
  pre-declaración) con rutas, Server Actions y nombres de archivo tal como
  existen, no como se planeaban. Incluye qué falta (alta de contribuyente,
  administración del formulario, niveles 2/3 de la cascada).
- `docs/data-model.md` reescrito para coincidir exactamente con
  `prisma/schema.prisma` — antes solo se había corregido la línea de
  `uuidv7()`, el resto seguía describiendo el diseño pre-reconciliación
  (nombres de tabla/campo que ya no existen, tablas que faltaban). Documenta
  también `taxpayers.created_by`, que no está en el diseño original (ver
  entrada del 2026-09-30).
- `docs/guides/coding-guidelines.md`: corregida la instrucción de "SQL
  crudo para agregaciones" (el dominio las calcula en TypeScript puro,
  intencionalmente, por ADR-001); la sección de pruebas ahora dice que no
  hay test runner configurado en vez de describir una convención
  (`tests/domain/`, etc.) que nunca existió.
- `README.md`: estado actualizado de "MVP en definición" a lo que
  realmente funciona hoy; la tabla de stack separa lo que está en uso de lo
  planeado (IA, Sentry, despliegue no están implementados todavía).
- `CLAUDE.md`: el contexto obligatorio ya no apunta a `docs/mvp-scope.md`
  (eliminado) sino a `docs/guides/code-flow.md`.
- `NEXT_STEPS.md`: quitados todos los ítems ya resueltos (quedan en el
  historial de este changelog, no duplicados ahí). Solo quedan decisiones
  abiertas, trabajo por construir y verificación normativa pendiente.

## [2026-10-03] `.env.local` se carga sola; ya no hace falta exportarla a mano

`npx prisma migrate dev`, `npm run db:seed`, `npm run db:reset` y
`npm run seed:test-taxpayer` pedían `export $(cat .env.local | xargs)` antes
de correr, porque ninguno pasa por el auto-load de `.env.local` que sí tiene
`next dev`. Comparado contra el patrón de `comprobify-web` (que no necesita
este paso): su `prisma.config.ts` y sus scripts (`db-reset.js`, `seed.js`)
cargan `.env.local` ellos mismos con `dotenv`.

### Agregado
- `dotenv` como dependencia de desarrollo.
- `prisma.config.ts` ahora llama a `dotenv`'s `config({ path: '.env.local' })`
  antes de `defineConfig(...)` — funciona para todo lo que pasa por la CLI
  de Prisma (`migrate`, `studio`, etc.), sin tocar los scripts de
  `package.json`.

### Corregido
- **El mismo patrón no funciona para `prisma/seed.ts` ni
  `scripts/seed-test-taxpayer.ts`.** Ambos importan `src/lib/db.ts`, que
  construye su `Pool` de Postgres al cargarse. esbuild (el compilador detrás
  de `tsx`) sube todos los `require` generados por `import` al tope del
  archivo compilado, sin importar dónde aparecían los `import` en el código
  fuente — así que un `import { config } from 'dotenv'; config(...)`
  escrito *antes* del `import` de `db.ts` de todas formas se ejecuta
  *después*, porque ambos `require` ya subieron al tope. `db.ts` terminaba
  leyendo `process.env.DATABASE_URL` como `undefined`, y Postgres rechazaba
  la conexión con un error de autenticación SASL que no menciona variables
  de entorno en ningún lado — habría sido muy fácil darlo por una falla de
  credenciales. Diagnosticado comparando una conexión directa con `pg` (que
  sí funcionaba) contra la misma conexión vía el adaptador de Prisma
  importado desde un archivo separado (que no).

  Arreglado sembrando `dotenv` por fuera del grafo de módulos, con
  `tsx --import dotenv/config` y `DOTENV_CONFIG_PATH=.env.local` en los
  scripts de `package.json`, en vez de un `import` dentro del propio
  archivo. `scripts/db-reset.ts` no necesitaba el cambio: no importa
  `db.ts` directamente, y el `prisma/seed.ts` que ejecuta como proceso hijo
  hereda el entorno ya correcto del proceso padre.
- `GETTING_STARTED.md`: quitados los tres pasos de
  `export $(cat .env.local | xargs)` — ya no hacen falta.

## [2026-10-04] La clave de acceso se parseaba con un layout inventado

Reportado por el usuario al cargar un archivo real de recibidas: todas las
filas fallaban con "Check digit mismatch", "Empty digits must be 000" y
"Receiver RUC ... does not match taxpayer [UUID]".

### Corregido
- **`access-key.ts` nunca se verificó contra el formato real.** Mismo tipo
  de error que ya se corrigió en `file-parser.ts` el 2026-09-30 — esta vez
  en el archivo que faltaba revisar en esa misma pasada. El layout de
  `parseAccessKey` no coincidía con la tabla verificada de
  `docs/tax/formato-archivos-sri.md` (que ADR-009 sí documentaba bien: el
  código nunca se alineó con ninguno de los dos):
  - El dígito verificador real está en la posición 48 (el último), no en
    la 23. La posición 23 es el dígito de "ambiente" (1 pruebas, 2
    producción) — por eso todos los errores decían "expected X, got 2": el
    código leía el ambiente y lo trataba como dígito verificador.
  - No existe un campo de "dígitos vacíos que deben ser 000". Esa posición
    (24-26) es en realidad el inicio del establecimiento dentro de la
    serie.
  - El RUC del emisor (13 dígitos, posición 10-22) nunca se extraía ni se
    comparaba contra nada.
  - El cálculo del dígito verificador (mod 11, pesos `7,6,5,4,3,2`) estaba
    bien, pero se aplicaba sobre los primeros 23 dígitos en vez de los
    primeros 48.
  Reescrito y verificado contra las dos claves reales de
  `formato-archivos-sri.md` (dígitos verificadores 4 y 5, ambos correctos
  con el layout corregido).
- **La Server Action de ingesta pasaba el UUID del contribuyente donde
  `ingestion-service.ts` esperaba su RUC.** Por eso el segundo error en
  cada fila: "Receiver RUC 1715824775 does not match taxpayer
  01a10783-...". Corregido para buscar `taxpayer.ruc` antes de validar.
- **`validateIssuedRow` no tenía forma de recibir el RUC del contribuyente**
  — pasaba `''` a `verifyAccessKeyConsistency`, que con la función ya
  corregida (antes era un placeholder que solo revisaba que no estuviera
  vacío) habría rechazado toda fila de ventas con "RUC cannot be empty".
  No se había manifestado todavía porque el usuario solo había probado
  recibidas. Agregado el parámetro.
- **La verificación de pertenencia no distinguía cédula (10 dígitos) de RUC
  completo (13 dígitos).** `IDENTIFICACION_RECEPTOR` trae la cédula cuando
  el receptor es persona natural (documentado en
  `formato-archivos-sri.md`), y el RUC completo es la cédula más un sufijo
  de 3 dígitos. Una comparación directa (`!==`) habría seguido fallando
  para el mismo archivo del usuario incluso después de arreglar el bug del
  UUID. Ahora acepta ambos casos.

## [2026-10-04] Pantallas de contribuyentes y períodos; navegación completa sin URLs a mano

Hasta ahora la única forma de crear un contribuyente o un período era
`scripts/seed-test-taxpayer.ts` contra la base directamente. Esta entrada
agrega las pantallas que lo reemplazan y cierra el hueco de navegación que
dejaban.

### Agregado
- `src/domain/iva/activity-fingerprint.ts` — `computeActivityFingerprint()`
  (ADR-006), pura: hash SHA-256 de las actividades económicas ordenadas. No
  existía ninguna implementación pese a que `Taxpayer.activityFingerprint`
  ya era un campo obligatorio del esquema.
- `/[locale]/(app)/taxpayers` — lista de contribuyentes del usuario, con
  logout (`signOut()` de `next-auth/react`).
- `/[locale]/(app)/taxpayers/new` — alta de contribuyente: RUC, razón
  social, nombre comercial opcional, régimen, periodicidad de IVA y
  actividades económicas (lista dinámica).
- `/[locale]/(app)/[taxpayerId]/periodos` — lista de períodos del
  contribuyente y alta de período nuevo (año + mes, mensual e IVA por
  ahora).
- `TROUBLESHOOTING.md` — errores de entorno e infraestructura, separado de
  `GETTING_STARTED.md` (que ahora es solo instalación + recorrido rápido).

### Cambiado
- `src/proxy.ts` pasó de lista negra (`pathname.includes('/periodos/')`,
  que no cubría `/taxpayers` ni `/[taxpayerId]/periodos` sin segmento
  final) a lista blanca: toda ruta exige sesión salvo `/login`, `/register`
  y la portada. Una pantalla nueva queda protegida por defecto.
- `/[locale]` (portada) ya no es una lista de módulos con un
  `taxpayerId`/`periodId` de demostración fijo (`/demo/periodos/demo`).
  Ahora redirige: con sesión a `/taxpayers`, sin sesión a `/login`.
- Las cuatro pantallas de período (ingesta, ventas, conciliación,
  pre-declaración) tenían un enlace "volver" que apuntaba a `/` sin
  resolver nada. Ahora llevan a la pantalla anterior real en la jerarquía
  (lista de períodos, o la raíz del período).
- `GETTING_STARTED.md`: la sección 5 pasó de "crear un contribuyente de
  prueba por script" a un recorrido completo dentro de la aplicación,
  registro incluido. "Verificación de RLS" y "Problemas frecuentes" se
  movieron a `TROUBLESHOOTING.md`.
- `docs/guides/code-flow.md`: nueva sección "0. Contribuyentes y períodos"
  documentando las pantallas y Server Actions nuevas, y la razón por la
  que `taxpayers` no tiene política de `DELETE` (deliberado, no un hueco).

### Eliminado
- `scripts/seed-test-taxpayer.ts` y el script `seed:test-taxpayer` de
  `package.json` — reemplazados por las pantallas reales.

### Hallazgo (sin cambio de código)
- La tabla `taxpayers` nunca tuvo política de RLS para `DELETE` —ni
  siquiera para `is_system_admin()`— y con `FORCE ROW LEVEL SECURITY` eso
  bloquea el comando por completo para cualquier fila, no solo lo filtra.
  Confirmado al verificar el flujo nuevo contra la base real: un
  contribuyente de prueba quedó sin forma de borrarse desde el rol `taxap`.
  Es coherente con la bitácora inmutable de ADR-013, así que se documenta
  en `TROUBLESHOOTING.md` en vez de tratarse como bug.

## [2026-10-04] Editar contribuyente y período; menú de navegación

### Agregado
- `/[locale]/(app)/[taxpayerId]/editar` — edición de contribuyente
  (razón social, nombre comercial, régimen, periodicidad, actividades);
  mismo formulario que el alta (`taxpayers/taxpayer-form.tsx`, ahora
  compartido entre `taxpayers/new` y esta pantalla).
- `updateTaxpayer()` (`[taxpayerId]/actions.ts`) — recalcula
  `activityFingerprint` igual que `createTaxpayer()`; RUC duplicado
  devuelve `RUC_IN_USE` excluyendo al propio contribuyente de la
  comprobación.
- `updatePeriodStatus()` y `deletePeriod()`
  (`[taxpayerId]/periodos/actions.ts`): transición manual
  `DRAFT ↔ UNDER_REVIEW` con evento en `classification_events`
  (ADR-013), y borrado de un período solo si está en `DRAFT` y sin
  comprobantes cargados.
- `src/app/[locale]/(app)/layout.tsx` — menú persistente (nombre de la
  app + logout) en toda la aplicación autenticada. No existía ningún
  layout compartido antes de esto; cada pantalla armaba su propio
  encabezado.
- `src/app/[locale]/(app)/[taxpayerId]/layout.tsx` — franja secundaria
  con la razón social y enlaces a "Períodos" / "Editar contribuyente"
  para todo lo que cuelga de un contribuyente.

### Cambiado
- `src/components/logout-button.tsx` — reubicado desde
  `taxpayers/logout-button.tsx`; ahora lo usa el layout de la app, no la
  pantalla de lista de contribuyentes.
- Botón "Reabrir período" agregado a `predeclaracion-client.tsx`: la
  función `reopenPeriod()` existía desde el bloqueo de período
  (entrada del 2026-10-02 de este changelog) pero ningún botón la
  llamaba.
- `taxpayers/page.tsx` y `[taxpayerId]/periodos/page.tsx` perdieron sus
  encabezados ad hoc (título + logout, o enlace de vuelta con la razón
  social) — ese rol lo cubren los dos layouts nuevos.

### Hallazgo (sin cambio de código)
- Verificando `updatePeriodStatus()`/`deletePeriod()` contra la base
  real, un período con al menos un evento en `classification_events`
  resultó imborrable incluso con el rol superusuario de Postgres — no es
  RLS (que el superusuario ignora), es el disparador
  `reject_classification_event_mutation()`
  (`prisma/migrations/20260930113100_add_rls/migration.sql`), que
  rechaza `DELETE`/`UPDATE` sobre esa tabla sin excepción. La bitácora es
  append-only de verdad. Documentado en `TROUBLESHOOTING.md`: para datos
  de prueba descartables, evitar transiciones de estado que generen un
  evento si hace falta poder limpiarlos después.

## [2026-10-04] Barra de pasos del período: navegación completa adelante y atrás

### Corregido
- **La raíz de un período no tenía ningún enlace hacia ingesta, ventas o
  conciliación.** Una vez creado un período, esas tres pantallas solo eran
  alcanzables escribiendo la URL a mano — exactamente lo que esta serie de
  cambios se propuso eliminar. Cada una de las cuatro pantallas del período
  tampoco tenía forma de saltar a otra que no fuera "un paso atrás": el
  único enlace era "← Volver" a la raíz.

### Agregado
- `period-step-nav.tsx` — barra de pestañas con los cuatro pasos del
  período (Ingesta, Ventas emitidas, Conciliación, Pre-declaración) en
  orden, el actual resaltado, cada uno enlazado directo a los otros tres.
  Montada en las cuatro pantallas (`ingesta/page.tsx`, `ventas/page.tsx`,
  `conciliacion/page.tsx`, la raíz del período), reemplazando el enlace
  único "← Volver" de cada una.
- Namespace `PeriodNav` en `messages/es.json` con las cuatro etiquetas
  cortas de la barra.

## [2026-10-04] Mes del período desalineado; menú lateral; módulo de administración

### Corregido
- **Un período creado como agosto se mostraba como julio.** `TaxPeriod.periodStart`
  es `@db.Date`; Prisma lo lee de vuelta como medianoche UTC. Tanto la
  pantalla de períodos (`periodos-client.tsx`) como la tabla de ventas
  (`ventas-table.tsx`, para `issueDate`) leían esa fecha con los getters
  de hora **local** (`getMonth`/`getFullYear`/`toLocaleDateString` sin
  huso fijo) — en cualquier zona detrás de UTC (Ecuador, UTC-5), la
  medianoche UTC del día 1 cae la noche anterior en hora local, y el mes
  mostrado retrocedía uno. Corregido a `getUTCMonth`/`getUTCFullYear` y
  `toLocaleDateString(locale, { timeZone: 'UTC' })`. `createPeriod()`
  también pasó a construir `periodStart`/`periodEnd` con `Date.UTC(...)`
  en vez de `new Date(year, month-1, 1)`, para no depender de la zona del
  proceso que corre el servidor. Verificado en esta misma máquina
  (`America/Guayaquil`, UTC-5, la condición real que causaba el error):
  un período de agosto 2026 creado con la lógica corregida se renderiza
  como "Agosto 2026" en la pantalla real.

### Agregado
- **Menú lateral persistente** (`src/components/app-sidebar.tsx`,
  montado por `(app)/layout.tsx`): "Mis contribuyentes" siempre,
  "Administración" solo para `role = ADMIN`. Siempre visible en
  escritorio; panel deslizante con hamburguesa en móvil. Reemplaza el
  header de una sola línea que ya existía — ese header en sí ya
  renderizaba correctamente (se confirmó con una sesión real contra el
  build existente); el ajuste es de prominencia e información, no de un
  menú que faltara en el código.
- **Modales** (`src/components/ui/dialog.tsx`, primer uso en el
  proyecto, envoltorio de `radix-ui`): crear período, crear versión de
  formulario, agregar casillero y cargar tasa de IVA pasaron de
  formularios inline a modales.
- **Módulo de administración** (`/admin/formularios`, `/admin/tasas`,
  ADR-015): el admin sube un PDF (solo para su `sha256` — no hay
  extracción automática del texto todavía, cada casillero se ingresa a
  mano), publica versiones del formulario, y carga tasas de IVA que
  exigen fuente y fecha de verificación antes de guardarse. `asAdmin()`
  tenía meses sin usarse en ningún punto de `src/app` — esta es su
  primera pantalla real.
- `requireAdmin()` (`src/lib/session.ts`): vuelve a consultar `users.role`
  contra la base en cada llamada, no confía en el claim del JWT de
  sesión (que puede seguir diciendo `ADMIN` después de que alguien
  pierda el rol, mientras el token no expire).
- `scripts/seed-admin-user.ts` + `npm run seed:admin`: crea o promueve
  una cuenta a `ADMIN`.
- `TaxRate.source`/`verifiedAt`/`createdBy` (migración
  `add_tax_rate_source`): el esquema no tenía dónde registrar de dónde
  salía una tasa cargada, aunque CLAUDE.md ya exigía esa trazabilidad.
  `/admin/tasas` no deja enviar el formulario sin ambos campos.

### Sin cambio (deliberado)
- **Ninguna tasa de IVA quedó cargada.** Ambas filas de
  [`docs/tax/tasas-iva.md`](docs/tax/tasas-iva.md) siguen `[VERIFICAR]` —
  CLAUDE.md prohíbe completar un `[VERIFICAR]` de memoria, así que
  `/admin/tasas` se entrega vacía a propósito.
- **`result_mappings` sigue sin calcularse.** La cascada de 4 niveles de
  ADR-015 no está implementada; publicar un formulario deja sus
  `form_fields` listos pero nada los conecta todavía con las claves de
  resultado del dominio.

## [2026-10-04] Extracción automática del PDF del formulario

### Agregado
- `src/services/forms/pdf-field-extractor.ts` — `extractCandidateFields()`,
  pura (ADR-001): heurística de texto plano sobre lo que `pdf-parse`
  extrae de la capa de texto del PDF. Agrupa corridas de 1 a 3 pares
  código-valor consecutivos y los asigna a `SINGLE` / `GROSS+NET` /
  `GROSS+NET+TAX` según la posición, siguiendo el orden fijo de columnas
  del formulario ("VALOR BRUTO · VALOR NETO · IMPUESTO GENERADO").
  Verificada contra el PDF de muestra real: los 10 códigos ya
  documentados en [`formulario-104.md`](docs/tax/formulario-104.md)
  (401/411/421, 500/510/520, 502/512/522, 563) salen con el código y el
  tipo de columna correctos.
- `createFormVersionDraft()` ahora corre esa extracción sobre el PDF
  subido y precarga los `form_fields` candidatos del borrador —
  `addFormField()`/`removeFormField()` siguen disponibles para corregir
  cualquier fila antes de publicar, que es obligatorio según ADR-015 sin
  importar qué tan buena sea la extracción.
- Dependencia nueva: `pdf-parse` (envuelve `pdfjs-dist`, extracción de
  texto puro en Node).

### Corregido (antes de llegar a un commit)
- La primera versión de la ventana de búsqueda del nombre de cada campo
  tomaba **todo el texto desde el campo anterior**, sin límite. Para la
  primera fila de la página 1 eso incluía el bloque de cabecera que trae
  la identidad del contribuyente (RUC, razón social) — en una prueba
  real contra el PDF de muestra, ese nombre y RUC terminaron escritos en
  `form_fields.label` antes de que el error se detectara y la fila de
  prueba se borrara de la base. Corregido para tomar como máximo las 2
  líneas inmediatamente anteriores a cada código, más una lista
  explícita de líneas de cabecera a ignorar (`Identificación:`, `Razón
  Social`, `CÓDIGO VERIFICADOR`, etc.) — nunca se confía en que el PDF no
  vuelva a traer algo parecido más adelante.

### Sin cambio (deliberado)
- La extracción sigue siendo heurística de texto plano, no usa la
  posición real de cada bloque de texto en la página. Fórmulas impresas
  dentro de una celda (ej. "482-484", "x 563") pueden generar una fila
  con el código o la columna equivocados; líneas envueltas en dos
  renglones pueden perder la primera mitad del nombre. Es exactamente el
  tipo de error que la revisión obligatoria del admin existe para
  atrapar — ver `NEXT_STEPS.md` para la alternativa basada en posición.
