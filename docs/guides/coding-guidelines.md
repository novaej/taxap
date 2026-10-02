# Guía de desarrollo

## Las cuatro capas

```
src/domain/     Reglas tributarias puras. Sin I/O.
src/services/   Orquestación: dominio + base de datos + IA.
src/lib/        Infraestructura: db, auth, rbac, ia, almacenamiento.
src/app/        Rutas, Server Actions, UI.
```

**La regla que sostiene todo:** `src/domain/` no importa `@prisma/client` ni
`next`. Si una función de dominio necesita la tasa de IVA, se le pasa como
parámetro; no la consulta.

Conviene una regla de lint que lo imponga. Sin ella, la separación se erosiona en
meses y con ella se pierde la capacidad de probar el motor sin infraestructura.

### Qué va en cada capa

| Ejemplo | Capa |
|---|---|
| "Con factor 0, ¿cuánto crédito hay?" | `domain/` |
| "Clasificar los comprobantes sin clasificar de este período" | `services/` |
| "Fijar `app.current_user_id` y abrir transacción" | `lib/` |
| "Mostrar la bandeja y permitir reasignar" | `app/` |

El CRUD simple (alta de contribuyente, edición de perfil) **no pasa por `domain/`**.
Va directo en la Server Action o en `services/`. La capa de dominio existe para las
reglas tributarias, no como ceremonia obligatoria.

Autenticación (`src/lib/auth.ts`, `src/lib/session.ts`) y la base
(`src/lib/db.ts`) son infraestructura — `lib/` — por la misma razón: no son
reglas tributarias.

## Acceso a datos

**Toda consulta de datos de contribuyentes pasa por el envoltorio de usuario.**

```ts
// Correcto
await withUser(userId, (tx) => tx.invoicesReceived.findMany({ ... }));

// Incorrecto — devuelve TODO, sin filtrar por usuario
await db.invoicesReceived.findMany({ ... });
```

La segunda forma compila y se ejecuta sin error. Ese es el problema.
Ver [ADR-004](../adr/004-rls-por-usuario-con-prisma.md).

**Prisma para CRUD y migraciones. Las agregaciones (totales, factor de
proporcionalidad) son TypeScript puro en `domain/`**
(`src/domain/iva/calculator.ts`, `proportionality.ts`), no SQL — así se
prueban sin base de datos, que es exactamente lo que pide
[ADR-001](../adr/001-nextjs-monolito-con-capa-de-dominio.md). Las Server
Actions (`src/app/.../actions.ts`) traen los comprobantes ya clasificados
con Prisma y se los pasan al dominio; el dominio nunca toca la base.

## Dinero

`DECIMAL(14,2)` en PostgreSQL, `Prisma.Decimal` en TypeScript. Ninguna operación
monetaria toca la coma flotante de JavaScript.

```ts
// Incorrecto
const total = invoices.reduce((s, i) => s + Number(i.subtotal), 0);

// Correcto
const total = invoices.reduce((s, i) => s.add(i.subtotal), new Decimal(0));
```

## Fechas tributarias

`DATE` sin zona horaria. Un comprobante emitido el 31/08 pertenece a agosto sin
importar dónde corra el servidor.

**El período lo determina `FECHA_EMISION`**, nunca `FECHA_AUTORIZACION`: una
factura de agosto autorizada el 1 de septiembre es de agosto.

## Valores normativos

Nunca constantes. Se consultan por la fecha del hecho:

```ts
// Incorrecto
const base = vatAmount.div(0.15);

// Correcto
const rate = await getVatRate(invoice.issueDate);
```

Ver [ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md).

## Clasificación

- La consulta a la IA es **por proveedor**, no por comprobante.
- Nunca se envía RUC ni nombre del contribuyente a la IA.
- Todo veredicto registra `classification_source`, `rules_version` y —si es IA—
  `model_id` y `prompt_version`.
- Todo cambio escribe un evento en `classification_events`.
- Por debajo del umbral de confianza, va a la bandeja. No se aplica "por si acaso".

## Pruebas

No hay todavía un test runner configurado (ni jest ni vitest en
`package.json`) — `src/services/ingestion/__tests__/file-parser.test.ts`
existe pero no corre. Primer paso pendiente antes de que esta sección
describa algo real: elegir runner e instalarlo.

Convención prevista una vez exista:

| Tipo | Ubicación | Necesita base de datos |
|---|---|---|
| Dominio | `src/domain/**/__tests__/` | No |
| RLS | `scripts/` (ver verificaciones ad hoc en `NEXT_STEPS.md`) | Sí |

Las de dominio son el activo principal. Una regla tributaria nueva llega con sus
casos límite cubiertos: factor cero, notas de crédito de otro período, comprobantes
con `IVA = 0`, facturas mixtas.

## Lenguaje del producto

El vocabulario no promete lo que el sistema no hace. Nunca "Declarar" ni "Listo
para declarar". Ver [ADR-014](../adr/014-caracter-asistivo-y-disclaimers.md).

Todo texto visible pasa por `next-intl`, en `messages/es.json`. Sin literales en
los componentes.
