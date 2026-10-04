# Architecture Decision Records

Each file documents one decision: the context in which it was made, what was
decided, what is gained, what is lost, and what alternatives were discarded.

An ADR is not edited when the decision changes — a new one is written that
replaces it, and the old one is marked *Superseded by ADR-NNN*. The history is
the point.

| # | Decision | Status |
|---|---|---|
| [001](001-nextjs-monolito-con-capa-de-dominio.md) | Next.js monolith with a pure domain layer | Accepted |
| [002](002-postgresql-propio-en-lugar-de-supabase.md) | Self-hosted PostgreSQL instead of Supabase | Accepted |
| [003](003-usuario-como-tenant-con-tabla-de-union.md) | The user is the tenant, with a join table | Accepted |
| [004](004-rls-por-usuario-con-prisma.md) | Row-Level Security per user with Prisma | Accepted |
| [005](005-clasificacion-en-cascada.md) | Four-level classification cascade | Accepted |
| [006](006-reglas-por-proveedor-y-actividad-economica.md) | Rules by supplier and economic activity | Accepted |
| [007](007-modo-sin-ia-y-catalogo-compartido.md) | No-AI mode and shared catalog | Accepted |
| [008](008-solo-totales-sin-detalle-de-lineas.md) | Totals only, no line-item detail | Accepted |
| [009](009-clave-de-acceso-como-clave-de-deduplicacion.md) | Access key as the deduplication key | Accepted |
| [010](010-tratamiento-por-tipo-de-comprobante.md) | Voucher-type allowlist | Accepted |
| [011](011-ingesta-y-clasificacion-en-dos-pasos.md) | Resumable two-step ingestion and classification | Accepted |
| [012](012-tasas-y-casilleros-como-datos-con-vigencia.md) | Rates and fields as data with effective dates | Accepted |
| [013](013-bitacora-inmutable-y-bloqueo-de-periodo.md) | Immutable audit log and period lock | Accepted |
| [014](014-caracter-asistivo-y-disclaimers.md) | The system's assistive character | Accepted |
| [015](015-definicion-del-formulario-desde-pdf.md) | Form definition imported from PDF | Accepted |
