# Common issues

For the step-by-step setup, see [`GETTING_STARTED.md`](GETTING_STARTED.md).

## Database

**`connection refused` on port 5432.** Another local PostgreSQL is
occupying the port. Check what's running with `docker ps` before creating
a new container — there's probably already one you can reuse.

**Registration fails / `plan_code` has nothing to point to.**
`npm run db:seed` wasn't run. `users.plan_code` is an FK to `plans.code`.

## Row-Level Security (RLS)

**Verifying that RLS works.** This is not optional. Before building on
top of this foundation, confirm that **both** flags are active on every
table holding taxpayer data — `ENABLE ROW LEVEL SECURITY` alone isn't
enough if the app connects with the same role that owns the tables
(which is the case here: `taxap` runs the migrations and also serves the
queries). Without `FORCE`, Postgres exempts the owner from its own
policies and queries silently return everything, unfiltered:

```bash
docker exec postgres18 psql -U postgres -d taxap_dev -c "
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN (
    'taxpayers', 'user_taxpayers', 'tax_periods', 'source_files',
    'invoices_received', 'invoices_issued', 'supplier_rules',
    'classification_events', 'period_results'
  );
"
# all three columns must be 't' in every row
```

With data from two different taxpayers, confirm that one user never sees
the other's, even by passing the identifier directly — the wrapper in
[`src/lib/db.ts`](src/lib/db.ts) (`withUser`/`asAdmin`) is the only
allowed path for touching these tables. **If this test fails, isolation
between clients does not exist.** See [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

> Pending: there's no permanent regression script for this yet — every
> check so far has been done ad hoc and never left as a reproducible
> artifact. See [`NEXT_STEPS.md`](NEXT_STEPS.md).

**Queries return other users' data.** The database user is a superuser,
`FORCE ROW LEVEL SECURITY` is missing on the table, or the code is
querying outside the wrapper that sets `app.current_user_id`.
See [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

**Queries return nothing even though the data is there.**
`app.current_user_id` is set to a value that doesn't match, or the
surrounding transaction isn't open — `withUser()` must run the `SET` and
the query inside the same `$transaction`, never as separate calls against
a pooled connection.

**A `DELETE` on `taxpayers` fails with "record not found" even though the
`SELECT` in the same transaction does see the row.** This isn't an RLS
bug: the `taxpayers` table only has policies for `SELECT`/`INSERT`/`UPDATE`
(`prisma/migrations/*_add_rls/migration.sql`), none for `DELETE` — not
even for `is_system_admin()`. With `FORCE ROW LEVEL SECURITY`, the absence
of a policy for a command blocks that command entirely for every row,
rather than filtering it down to zero visible rows. This is deliberate: a
taxpayer is never deleted from the application. If one needs to be deleted
in development, it's done by hand with Postgres's superuser role (never
with the `taxap` role).

**Not even the superuser can delete a row from `classification_events`.**
Unlike the above, this isn't RLS (which the superuser does bypass) — it's
an actual trigger, `reject_classification_event_mutation()`
(`prisma/migrations/20260930113100_add_rls/migration.sql`, ADR-013), which
unconditionally rejects any `DELETE`/`UPDATE` on that table for any role.
A `taxPeriod` with at least one logged event (any status change:
`lockPeriod`, `reopenPeriod`, the newer `updatePeriodStatus`) therefore
becomes permanently undeletable, and with it its `taxpayer`. This is
intentional — the audit log is truly append-only, not just "hard to edit
from the app" — but it matters to know before seeding test data against
the real database: any data that triggers a classification event can
never be cleaned up afterward, not even by hand. For disposable test
data, avoid status transitions on taxpayers/periods that you can't leave
in place forever.

## Form PDF extraction

**Before widening `LABEL_LOOKBACK_LINES` or touching `BOILERPLATE_LINE` in
`src/services/forms/pdf-field-extractor.ts`, re-test against a real PDF.**
The first version of that code took all the text from the previous field
onward as a candidate field name, with no limit — and in a real test
against the sample PDF, that was enough for the taxpayer's RUC and legal
name (repeated in the header of every page) to end up written into
`form_fields.label` before anyone noticed. It was fixed by capping the
window to 2 lines and adding an explicit list of header lines to ignore,
but both are patches for one specific PDF, not a general guarantee. Any
change to that file needs to repeat the test: extract from `samples/*.pdf`
(never version-controlled, it carries personal data) and search the
output for the taxpayer's RUC/name before trusting it.

## Dates

**A date stored as `@db.Date` displays one day (or one month) earlier
than expected.** Prisma reads an `@db.Date` back as **UTC** midnight,
never local midnight. In any timezone behind UTC (Ecuador, UTC-5),
formatting that date with local-time getters (`getMonth()`,
`getFullYear()`, `toLocaleDateString()` without `timeZone`) rolls it back
a day — and if the day is 1, it rolls back an entire month. This actually
happened with `tax_periods.period_start` (`periodos-client.tsx`) and
`invoices_issued.issue_date` (`ventas-table.tsx`): an August period
displayed as July. The rule: any value read from a `@db.Date` column is
displayed with the **UTC** getters (`getUTCMonth`/`getUTCFullYear`/
`getUTCDate`) or with `toLocaleDateString(locale, { timeZone: 'UTC' })` —
never with local getters. When building one of these values to store it,
use `Date.UTC(year, month, day)`, not `new Date(year, month, day)` (which
uses the timezone of the process running the code, not the user's).

## Routes and sessions

**A protected route doesn't redirect to `/login` without a session.**
Check that the proxy file is at `src/proxy.ts` (not at the project root,
and not named `middleware.ts` — Next.js 16 renamed the convention; with a
`src/` directory, it only recognizes `src/proxy.ts`). `src/proxy.ts`
protects by exclusion (everything requires a session except `/login`,
`/register`, and `/`): if a new route ends up public by accident, check
`isPublicPath()` there, not a list of protected routes that would need to
be maintained by hand.
