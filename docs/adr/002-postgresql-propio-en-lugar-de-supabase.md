# ADR-002: Self-hosted PostgreSQL instead of Supabase

## Status
Accepted

## Date
2026-09-20

## Context

The initial product plan specified Supabase (PostgreSQL + Auth + Storage)
with Row-Level Security for isolation between clients.

Supabase solves authentication, file storage, and RLS tied to `auth.uid()`
out of the box. Its distinguishing advantage is letting the browser query the
database **directly**, with RLS as the only barrier.

taxap's architecture is Server Actions and server-side rendering
([ADR-001](001-nextjs-monolito-con-capa-de-dominio.md)): **no query ever
leaves the browser.** They all go through the server, which has already
authenticated the user.

Moreover, the data is third-party tax information. An accountant is going to
ask where their clients' tax data resides.

## Decision

**Self-hosted PostgreSQL.** In development, in Docker
(`docker-compose.yml`). In production, a managed PostgreSQL — provider to be
determined (see `NEXT_STEPS.md`).

The pieces Supabase would have provided are covered as follows:

| Need | Solution |
|---|---|
| Authentication | NextAuth v5 + bcryptjs |
| RLS | Native PostgreSQL, transactional GUC ([ADR-004](004-rls-por-usuario-con-prisma.md)) |
| Storage | Local filesystem in dev; S3-compatible storage in production |

## Consequences

### Positive
- A single piece of infrastructure, a single provider, a single backup
  regime.
- Control over where tax data resides, which is a real commercial question
  in this market.
- No latency between the application and a database hosted by another
  provider.
- Portable: moving PostgreSQL between providers is a `pg_dump`.

### Negative
- Registration, login, password recovery, and email verification all have to
  be built. Supabase gave these out of the box. Estimated: several days.
- Backups have to be operated; they don't come for free.
- RLS with an ORM requires explicit care
  ([ADR-004](004-rls-por-usuario-con-prisma.md)); with Supabase it came
  built in.

## Alternatives considered

**Full Supabase.** Faster to bootstrap. Discarded because its main
benefit — direct queries from the browser — isn't used in this
architecture, and it adds a second provider with its own billing, backups,
and incident surface in exchange.

**Supabase for authentication only, own data.** Avoids building the auth
module, but couples login to an external provider and forces identity
synchronization between two systems. Little benefit for the coupling it
introduces.
