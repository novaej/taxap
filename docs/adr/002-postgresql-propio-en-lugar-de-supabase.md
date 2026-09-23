# ADR-002: PostgreSQL propio en lugar de Supabase

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El planteamiento inicial del producto especificaba Supabase (PostgreSQL + Auth +
Storage) con Row-Level Security para el aislamiento entre clientes.

Supabase resuelve de entrada autenticación, almacenamiento de archivos y RLS atada
a `auth.uid()`. Su ventaja distintiva es permitir que el navegador consulte la base
de datos **directamente**, con la RLS como única barrera.

La arquitectura de taxap es Server Actions y renderizado en servidor
([ADR-001](001-nextjs-monolito-con-capa-de-dominio.md)): **ninguna consulta sale
del navegador.** Todas pasan por el servidor, que ya autenticó al usuario.

Además, los datos son información tributaria de terceros. Un contador va a
preguntar dónde reside la información fiscal de sus clientes.

## Decisión

**PostgreSQL propio.** En desarrollo, en Docker (`docker-compose.yml`). En
producción, un PostgreSQL gestionado — proveedor por definir
(ver `NEXT_STEPS.md`).

Los componentes que Supabase habría aportado se cubren así:

| Necesidad | Solución |
|---|---|
| Autenticación | NextAuth v5 + bcryptjs |
| RLS | PostgreSQL nativo, GUC transaccional ([ADR-004](004-rls-por-usuario-con-prisma.md)) |
| Almacenamiento | Filesystem en local; almacenamiento compatible con S3 en producción |

## Consecuencias

### Positivas
- Una sola infraestructura, un solo proveedor, un solo régimen de respaldos.
- Control sobre dónde residen los datos tributarios, que es una pregunta comercial
  real en este mercado.
- Sin latencia entre la aplicación y una base de datos de otro proveedor.
- Portable: mover el PostgreSQL entre proveedores es un `pg_dump`.

### Negativas
- Hay que construir el registro, el inicio de sesión, la recuperación de contraseña
  y la verificación de correo. Supabase los daba hechos. Estimado: varios días.
- Hay que operar los respaldos, no vienen dados.
- La RLS con un ORM requiere cuidado explícito
  ([ADR-004](004-rls-por-usuario-con-prisma.md)); con Supabase venía integrada.

## Alternativas consideradas

**Supabase completo.** Arranque más rápido. Descartado porque su beneficio
principal —consultas directas desde el navegador— no se usa en esta arquitectura,
y agrega un segundo proveedor con su propia facturación, respaldos y superficie
de incidentes a cambio.

**Supabase solo para autenticación, datos propios.** Evita construir el módulo de
autenticación, pero acopla el inicio de sesión a un proveedor externo y obliga a
sincronizar identidades entre dos sistemas. Poco beneficio para el acoplamiento
que introduce.
