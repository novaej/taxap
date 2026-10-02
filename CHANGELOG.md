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
