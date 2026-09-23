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

MVP en definición. Solo IVA mensual (formulario 104). Impuesto a la Renta,
Retenciones y ATS están contemplados en el modelo de datos pero fuera de alcance
— ver [`NEXT_STEPS.md`](NEXT_STEPS.md).

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| i18n | next-intl (es primario) |
| Base de datos | PostgreSQL 16+ (Docker en local) |
| Acceso a datos | Prisma 7 + `@prisma/adapter-pg`; SQL crudo para agregaciones |
| Aislamiento | Row-Level Security por usuario |
| Autenticación | NextAuth v5 + bcryptjs |
| IA (opcional) | Claude Haiku 4.5 vía Batch API; Opus 5 para escalamiento |
| Observabilidad | Sentry |
| Despliegue | Por definir — ver `NEXT_STEPS.md` |

## Documentación

| Documento | Contenido |
|---|---|
| [`GETTING_STARTED.md`](GETTING_STARTED.md) | Levantar el proyecto en local |
| [`docs/mvp-scope.md`](docs/mvp-scope.md) | Qué entra y qué no, con criterios de aceptación |
| [`docs/data-model.md`](docs/data-model.md) | Esquema comentado |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura y su justificación |
| [`docs/tax/`](docs/tax/) | Referencia tributaria y formato de los archivos del SRI |
| [`docs/guides/`](docs/guides/) | Cómo construir funcionalidades aquí |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para asistentes de IA |
| [`NEXT_STEPS.md`](NEXT_STEPS.md) | Pendientes y decisiones abiertas |
