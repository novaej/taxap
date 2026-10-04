# ADR-004: Row-Level Security per user with Prisma

> **Update (2026-09-30):** this ADR's policy example uses
> `NULLIF(current_setting(...), '') IS NULL` as the admin bypass — meaning
> any query where the session variable simply **isn't set** passes through
> unfiltered. Implemented as written, that makes a deliberate call to
> `asAdmin()` indistinguishable from a query someone forgot to wrap in
> `withUser()` — exactly the failure hard rule #2 in `CLAUDE.md` forbids.
> This was fixed: `asAdmin()` now sets an explicit sentinel id
> (`00000000-0000-0000-0000-000000000000`, impossible for a real user
> because real ids come from `uuidv7()`), never `RESET`. An unset variable
> now fails closed — it sees nothing — instead of failing open. The rest of
> the ADR is unchanged; see `prisma/migrations/*_add_rls` and
> `src/lib/db.ts` for the current implementation.

## Status
Accepted

## Date
2026-09-20

## Context

Isolation between taxpayers today would depend entirely on every query
including its filter. A single query that forgets the `WHERE` exposes one
client's accounting to another — the worst possible failure for this
product.

`comprobify` already solved this on plain PostgreSQL
(`comprobify/docs/adr/012-postgresql-row-level-security.md`): a
transactional configuration variable (`set_config('app.current_issuer_id',
$1, true)`) read by the policies, with `FORCE ROW LEVEL SECURITY` so they
also apply to the table owner.

The difference here is the ORM. `comprobify` uses raw `pg` and controls
every transaction. Prisma maintains a pool and reuses connections: **a
session variable set in one query can leak into the next operation from a
different user.**

## Decision

**RLS on `app.current_user_id`, set with `SET LOCAL` inside an interactive
Prisma transaction**, never at the session level.

All access to taxpayer data goes through a single wrapper, something like
`withUser(userId, fn)`, that opens a transaction, sets the variable, and
executes. No protected table is queried outside that wrapper.

Policy for tables with a direct link to the user:

```sql
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers FORCE ROW LEVEL SECURITY;

CREATE POLICY taxpayers_isolation ON taxpayers
  AS PERMISSIVE FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = taxpayers.id
        AND ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
```

Child tables (`invoices_received`, `tax_periods`, …) use an equivalent
subquery against `taxpayers`.

**The bypass when the variable isn't set is deliberate**, just as in
`comprobify`: there are routes that legitimately have no user (migrations,
admin tasks, `/health`). Those routes authenticate by other means and don't
touch taxpayer data.

**The application's database user cannot be a superuser.** Superusers
bypass RLS unconditionally, even with `FORCE`. This is an operational
requirement with no way to enforce it from code, which is why it's also in
`GETTING_STARTED.md`.

## Consequences

### Positive
- Defense in depth: a query that forgets the filter doesn't return someone
  else's data.
- ORM-independent. If Prisma is replaced, the policies are still there.
- The variable is transactional: if the transaction fails, it rolls back on
  its own. No risk of context leaking when a pooled connection is reused.

### Negative
- **Every read, even a trivial one, requires a transaction.** Two extra
  round trips (`BEGIN` / `COMMIT`) per loose query.
- Easy to get wrong: calling `prisma.invoice.findMany()` directly instead of
  going through the wrapper compiles and runs — it returns everything,
  unfiltered. Requires a lint rule or disciplined review.
- New ground for this set of projects: `comprobify` does RLS without an
  ORM, `comprobify-web` uses an ORM without RLS. **This must be verified
  with an early integration test** confirming that user A never sees user
  B's data, before building on this foundation.

## Alternatives considered

**Application-level filtering only.** No overhead, but a single bug exposes
third-party tax data. Unacceptable for this product.

**One PostgreSQL schema per user.** Strong isolation, but migrations
multiply by the number of users and the DDL becomes operationally complex.

**Session-level RLS instead of transaction-level.** Avoids wrapping
transactions, but with a connection pool the variable outlives the request
and leaks into the next one. Dangerous precisely in the scenario RLS is
meant to prevent.
