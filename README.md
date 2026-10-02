# taxap

Asistente de cálculo tributario para Ecuador (SRI). Acelera la preparación de la
declaración de IVA a partir de los archivos de comprobantes que el contribuyente
descarga del portal del SRI.

> **taxap no presenta declaraciones ni sustituye el criterio profesional.**
> Produce borradores de cálculo que deben ser revisados y validados por el
> responsable antes de presentarse al SRI. Ver [ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md).

## Para quién

| Perfil | Rol en el sistema | Contribuyentes |
|---|---|---|
| Persona natural que lleva su propia contabilidad | `INDIVIDUAL` | 1 |
| Contador independiente o despacho | `ACCOUNTANT` | N, según plan |

## Qué hace

1. **Ingesta** — carga de los archivos `.txt` de comprobantes recibidos y emitidos
   del SRI, con validación de integridad y deduplicación por clave de acceso.
2. **Clasificación** — cascada determinista (reglas aprendidas → catálogo
   compartido → IA opcional → revisión manual) que asigna a cada compra su
   tratamiento de IVA.
3. **Conciliación** — bandeja donde el usuario aprueba, reasigna o excluye lo que
   el sistema no pudo resolver con confianza. Cada decisión se convierte en regla.
4. **Pre-declaración** — totales por casillero del formulario 104, con desglose
   trazable hasta la factura individual.

## Estado

MVP funcional para IVA mensual (formulario 104): registro, ingesta de
archivos, clasificación de compras, marcado de ventas, cálculo de
resultados y bloqueo de período funcionan de principio a fin contra una
base real. Todavía sin pantalla de alta de contribuyente (el puente es
`scripts/seed-test-taxpayer.ts`) ni de administración del formulario —
ver [`NEXT_STEPS.md`](NEXT_STEPS.md) para el estado exacto.

Impuesto a la Renta, Retenciones y ATS están contemplados en el modelo de
datos pero fuera de alcance del MVP.

## Stack

En uso hoy:

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| i18n | next-intl (solo `es` por ahora) |
| Base de datos | PostgreSQL 18+ (Docker en local) |
| Acceso a datos | Prisma 7 + `@prisma/adapter-pg` |
| Cálculo de IVA | Dominio puro en TypeScript/`Decimal.js` — sin SQL de agregación |
| Aislamiento | Row-Level Security por usuario |
| Autenticación | NextAuth v5 (credenciales) + bcryptjs |

Planeado, no implementado todavía (ver [`NEXT_STEPS.md`](NEXT_STEPS.md)):

| Capa | Tecnología |
|---|---|
| IA (clasificación nivel 3) | Claude Haiku 4.5 vía Batch API; Opus 5 para escalamiento |
| Observabilidad | Sentry |
| Despliegue | Por definir |

## Documentación

| Documento | Contenido |
|---|---|
| [`GETTING_STARTED.md`](GETTING_STARTED.md) | Levantar el proyecto en local, de cero a corriendo |
| [`docs/guides/code-flow.md`](docs/guides/code-flow.md) | Cómo funciona la app hoy, pantalla por pantalla |
| [`docs/data-model.md`](docs/data-model.md) | Esquema comentado |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura y su justificación |
| [`docs/tax/`](docs/tax/) | Referencia tributaria y formato de los archivos del SRI |
| [`docs/guides/coding-guidelines.md`](docs/guides/coding-guidelines.md) | Convenciones para escribir código aquí |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para asistentes de IA |
| [`NEXT_STEPS.md`](NEXT_STEPS.md) | Pendientes y decisiones abiertas |
| [`CHANGELOG.md`](CHANGELOG.md) | Historial de cambios |
