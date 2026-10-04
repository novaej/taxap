# Development guide

## The four layers

```
src/domain/     Pure tax rules. No I/O.
src/services/   Orchestration: domain + database + AI.
src/lib/        Infrastructure: db, auth, rbac, ai, storage.
src/app/        Routes, Server Actions, UI.
```

**The rule that holds everything up:** `src/domain/` never imports
`@prisma/client` or `next`. If a domain function needs the VAT rate, it's
passed as a parameter; it never queries for it.

A lint rule enforcing this would help. Without one, the separation erodes
over months, and with it goes the ability to test the engine without
infrastructure.

### What goes in each layer

| Example | Layer |
|---|---|
| "At factor 0, how much credit is there?" | `domain/` |
| "Classify this period's unclassified vouchers" | `services/` |
| "Set `app.current_user_id` and open a transaction" | `lib/` |
| "Show the queue and allow reassignment" | `app/` |

Simple CRUD (creating a taxpayer, editing a profile) **doesn't go through
`domain/`**. It goes directly in the Server Action or in `services/`. The
domain layer exists for tax rules, not as mandatory ceremony.

Authentication (`src/lib/auth.ts`, `src/lib/session.ts`) and the database
(`src/lib/db.ts`) are infrastructure — `lib/` — for the same reason: they
aren't tax rules.

## Data access

**Every query on taxpayer data goes through the user wrapper.**

```ts
// Correct
await withUser(userId, (tx) => tx.invoicesReceived.findMany({ ... }));

// Wrong — returns EVERYTHING, unfiltered by user
await db.invoicesReceived.findMany({ ... });
```

The second form compiles and runs without error. That's the problem.
See [ADR-004](../adr/004-rls-por-usuario-con-prisma.md).

**Prisma for CRUD and migrations. Aggregations (totals, proportionality
factor) are pure TypeScript in `domain/`**
(`src/domain/iva/calculator.ts`, `proportionality.ts`), not SQL — this
way they're tested without a database, which is exactly what
[ADR-001](../adr/001-nextjs-monolito-con-capa-de-dominio.md) calls for.
Server Actions (`src/app/.../actions.ts`) fetch the already-classified
vouchers with Prisma and hand them to the domain; the domain never
touches the database.

## Money

`DECIMAL(14,2)` in PostgreSQL, `Prisma.Decimal` in TypeScript. No
monetary operation ever touches JavaScript floating point.

```ts
// Wrong
const total = invoices.reduce((s, i) => s + Number(i.subtotal), 0);

// Correct
const total = invoices.reduce((s, i) => s.add(i.subtotal), new Decimal(0));
```

## Tax dates

`DATE` with no time zone. A voucher issued on 08/31 belongs to August
regardless of where the server runs.

**The period is determined by `FECHA_EMISION`**, never
`FECHA_AUTORIZACION`: an August invoice authorized on September 1 is
still August's.

## Normative values

Never constants. They're looked up by the date of the event:

```ts
// Wrong
const base = vatAmount.div(0.15);

// Correct
const rate = await getVatRate(invoice.issueDate);
```

See [ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md).

## Classification

- The AI query is **per supplier**, not per voucher.
- RUC and taxpayer name are never sent to the AI.
- Every verdict records `classification_source`, `rules_version`, and
  —if AI— `model_id` and `prompt_version`.
- Every change writes an event to `classification_events`.
- Below the confidence threshold, it goes to the queue. Nothing is
  applied "just in case."

## Testing

There's no test runner configured yet (neither jest nor vitest in
`package.json`) — `src/services/ingestion/__tests__/file-parser.test.ts`
exists but doesn't run. First pending step before this section describes
anything real: choose a runner and install it.

Planned convention once one exists:

| Type | Location | Needs a database |
|---|---|---|
| Domain | `src/domain/**/__tests__/` | No |
| RLS | `scripts/` (see ad hoc checks in `NEXT_STEPS.md`) | Yes |

Domain tests are the main asset. A new tax rule arrives with its edge
cases covered: zero factor, credit notes from another period, vouchers
with `IVA = 0`, mixed invoices.

## Product language

The vocabulary never promises what the system doesn't do. Never "File"
nor "Ready to file." See
[ADR-014](../adr/014-caracter-asistivo-y-disclaimers.md).

All visible text goes through `next-intl`, in `messages/es.json`. No
literals in components.
