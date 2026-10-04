# ADR-001: Next.js monolith with a pure domain layer

## Status
Accepted

## Date
2026-09-20

## Context

There were three ways to structure this:

1. **Separate API + frontend**, like `comprobify` and `comprobify-web`.
2. **Flat Next.js monolith**, with all logic in `src/lib/`, like `comprobify-web`.
3. **Monolith with a domain layer**, borrowing the layered separation from
   `salon-cloud`.

`comprobify-web` works fine with a flat `src/lib/` because it's essentially a
BFF: the business logic lives in the `comprobify` API and the frontend just
consumes it.

taxap is the opposite. The tax engine **is** the product. The classification
logic, the proportionality factor, and the assembly of form fields are rules
with many edge cases, where a bug doesn't produce a visible error — it
produces an incorrect filing.

No external API consumers are planned, so splitting into two repos would add
a contract, a deployment, and an authentication surface with no current
benefit.

## Decision

**A single repository, a Next.js app, with an isolated pure domain layer.**

```
src/
├── domain/      ← no I/O. Doesn't import Prisma, next, or fetch.
├── services/    ← orchestration: domain + database + AI
├── lib/         ← infrastructure (db, auth, rbac, ai, storage)
├── app/         ← routes, Server Actions, UI
└── components/
```

The hard rule: **`src/domain/` imports nothing from `@prisma/client` or
`next`.** It receives plain objects and returns verdicts. It's tested with
Vitest, with no database and no server.

The tests under `tests/domain/` are the single most valuable asset in the
repository.

## Consequences

### Positive
- The tax engine is exhaustively tested in milliseconds, with no
  infrastructure.
- Changing ORM, framework, or UI doesn't touch the tax rules.
- If exposing the engine as an API becomes necessary in the future, `domain`
  and `services` can be extracted without rewriting them.

### Negative
- One more layer of indirection than a flat `src/lib/`. For simple CRUD
  (creating a taxpayer, editing a profile) it's overhead with no return —
  that code goes directly in `services/` or the Server Action, bypassing
  `domain/`.
- Discipline isn't self-enforcing. It requires a lint rule that forbids
  importing `@prisma/client` from `src/domain/`, or it erodes by the third
  month.

## Alternatives considered

**Separate API in two repos.** Would be justified if selling API access to
other accounting systems were planned. That's not the case today, and the
domain layer leaves that door open without paying the cost now.

**Flat monolith, `comprobify-web` style.** Faster to bootstrap. Discarded
because it mixes tax rules with data access, so testing "what happens if the
proportionality factor comes out to zero?" requires a database loaded with
data. That's how tests end up not getting written.

**Full Clean Architecture, `salon-cloud` style** (Domain / Application /
Infrastructure / Web as separate projects). Appropriate in .NET with multiple
teams; excessive for a single-developer TypeScript repository. The idea of a
pure core is adopted; the ceremony isn't.
