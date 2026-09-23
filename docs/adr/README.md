# Registro de Decisiones de Arquitectura

Cada archivo documenta una decisión: el contexto en que se tomó, qué se decidió,
qué se gana, qué se pierde y qué alternativas se descartaron.

Un ADR no se edita cuando la decisión cambia — se escribe uno nuevo que lo
reemplaza, y el viejo se marca como *Reemplazado por ADR-NNN*. El historial es
el punto.

| # | Decisión | Estado |
|---|---|---|
| [001](001-nextjs-monolito-con-capa-de-dominio.md) | Monolito Next.js con capa de dominio pura | Aceptado |
| [002](002-postgresql-propio-en-lugar-de-supabase.md) | PostgreSQL propio en lugar de Supabase | Aceptado |
| [003](003-usuario-como-tenant-con-tabla-de-union.md) | El usuario es el tenant, con tabla de unión | Aceptado |
| [004](004-rls-por-usuario-con-prisma.md) | Row-Level Security por usuario con Prisma | Aceptado |
| [005](005-clasificacion-en-cascada.md) | Clasificación en cascada de cuatro niveles | Aceptado |
| [006](006-reglas-por-proveedor-y-actividad-economica.md) | Reglas por proveedor y actividad económica | Aceptado |
| [007](007-modo-sin-ia-y-catalogo-compartido.md) | Modo sin IA y catálogo compartido | Aceptado |
| [008](008-solo-totales-sin-detalle-de-lineas.md) | Solo totales, sin detalle de líneas | Aceptado |
| [009](009-clave-de-acceso-como-clave-de-deduplicacion.md) | Clave de acceso como clave de deduplicación | Aceptado |
| [010](010-tratamiento-por-tipo-de-comprobante.md) | Lista blanca de tipos de comprobante | Aceptado |
| [011](011-ingesta-y-clasificacion-en-dos-pasos.md) | Ingesta y clasificación en dos pasos reanudables | Aceptado |
| [012](012-tasas-y-casilleros-como-datos-con-vigencia.md) | Tasas y casilleros como datos con vigencia | Aceptado |
| [013](013-bitacora-inmutable-y-bloqueo-de-periodo.md) | Bitácora inmutable y bloqueo de período | Aceptado |
| [014](014-caracter-asistivo-y-disclaimers.md) | Carácter asistivo del sistema | Aceptado |
| [015](015-definicion-del-formulario-desde-pdf.md) | Definición del formulario importada desde PDF | Aceptado |
