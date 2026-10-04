# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Imperative mood: "Add", not "Added".

## [Unreleased]

### Added
- `docs/site/screens/`: specifications for ingestion, issued sales,
  reconciliation, pre-filing, and form administration — the contract for
  each screen before building it
- Project documentation base: README, GETTING_STARTED, CLAUDE.md, NEXT_STEPS
- 14 ADRs with the MVP's architecture decisions
- `docs/mvp-scope.md` with scope and acceptance criteria
- `docs/data-model.md` with the commented schema
- `docs/tax/formato-archivos-sri.md` verified against real SRI files
- `docs/tax/tasas-iva.md` and `docs/tax/formulario-104.md` as scaffolding
  pending normative verification
- ADR-015: the system knows Form 104 (full catalog imported from a PDF
  that isn't saved) and relates each result to its field by meaning
- `docs/tax/formulario-104.md`: field catalog verified against a real
  form, with the MVP's results and each one's expected field
- Tables `form_versions`, `form_fields`, `result_mappings`, and
  `period_results` in the data model

### Changed
- **Form 104 is the destination for results, not a source of
  calculation.** The domain produces results with a stable key and
  doesn't know field numbers. The formulas printed on the form stay in
  `formulario-104.md` as reference material for whoever implements the
  domain; the system never reads or executes them.
- **Form import.** The admin uploads the PDF once; only the full field
  catalog (code, name, section) is saved and nothing else: not the PDF,
  not values, not personal data. The system relates each result to its
  field via a cascade (stored relationship → attribute match → optional
  AI → no field) and stores the relationship per form version, together
  with the reason it was placed there. The admin is of the system and
  does not correct relationships.
- **Form scope reduced to the basics of sales and purchases.** Out of
  scope: settlement, prior credit balances (605), and the total due.
- **Sales with `IVA = 0`: marked by the user** in a table after upload.
  The factor isn't calculated while any sales remain unmarked. The audit
  log also covers this marking.
- **Purchases with `IVA = 0` without a per-voucher decision**: an
  informational total with an approximate suggested field.
- **`attribution` is removed.** A purchase's classification is 500 or
  502.
- **The MVP is limited to the monthly form.** The semiannual one moves
  to `NEXT_STEPS.md`.

### Fixed
- **Proportionality factor.** It had been documented that sales without
  VAT give a factor of zero. That's incorrect: exports and 0%-rated sales
  with credit entitlement add to the numerator (`1.0000` for someone who
  only exports services). Fixed in `mvp-scope.md`, `code-flow.md`,
  `formato-archivos-sri.md`, and `CLAUDE.md`.
- ADR-008 and ADR-010 annotated: `IVA = 0` without a decision applies to
  purchases, not sales; withholding vouchers might feed into field 609.
- **`docker-compose.yml` removed.** Local development uses a
  hand-managed `postgres18` container (`docker start` / `docker run` +
  `scripts/setup-db.sh`), not `docker compose up`. ADR-002 still names
  `docker-compose.yml` as the chosen mechanism — a new ADR to formally
  replace it is still pending; for now `docs/LOCAL-DEVELOPMENT.md` is the
  source of truth for the actual workflow.
- **`GETTING_STARTED.md` was out of date.** It said PostgreSQL 16+ (it's
  18+), and listed `npm run migrate` and `npm run test:rls`, which don't
  exist (the real script is `db:migrate`; there's still no permanent RLS
  isolation test). Fixed to reflect the steps that actually work today.
- **RLS silently filtered nothing.** The RLS migration
  (`20260924062837_add_rls`) had two bugs: policies against `snake_case`
  columns that don't exist (the schema has no `@map`, they're
  `camelCase`), and without `FORCE ROW LEVEL SECURITY` the `taxap` role —
  owner of the tables — was exempt from its own policies. Neither
  produced a visible error. Fixed and manually verified against the real
  database. See [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md),
  `NEXT_STEPS.md`, and `CLAUDE.md` → "Easy mistakes to make here".

### Documentation audit
- Reviewed the repository's 32 `.md` files against the real state of the
  code. The ADRs and `docs/tax/` are up to date. The pre-code specs
  (`data-model.md`, `mvp-scope.md`, `code-flow.md`,
  `coding-guidelines.md`, `docs/site/screens/`) described a more
  elaborate design than what was built — reconciled on 2026-09-30, see
  below.

## [2026-09-30] Reconciling the code with the pre-code specs

### Added
- Prisma schema rewritten to follow `docs/data-model.md`: `id` using
  native `uuidv7()` (PostgreSQL 18, no extension) instead of `cuid()`;
  every column mapped to `snake_case` via `@map`; `plans` and `ai_usage`
  tables; fields that were missing on `taxpayers`, `tax_periods`,
  `invoices_received`, `invoices_issued`, `supplier_rules`.
  `taxpayers.created_by` was added even though it wasn't in the spec —
  needed for Prisma to be able to create a taxpayer at all (see Fixed).
- `scripts/db-reset.ts` (`npm run db:reset`), modeled on
  `comprobify/db/reset.js`: blocked in production, drops tables/types/
  functions from `public` and reapplies the migrations.
- Routing moved to
  `src/app/[locale]/(app)/[taxpayerId]/periodos/[periodId]/...` with
  `next-intl` (`messages/es.json`) and Server Actions, replacing the flat
  routes and REST API routes.
- Tailwind 4 + shadcn/ui (`components.json`, `src/components/ui/`)
  instead of inline styles.

### Fixed
- **RLS, two more bugs** beyond the ones already fixed on 2026-09-24
  (see that day's entry): Prisma's `INSERT ... RETURNING` — which
  `.create()` always uses — gets filtered by the `SELECT` policy, so no
  one could create a taxpayer until `taxpayers.created_by` was added.
  And ADR-004's own policy example *bypasses* when the session variable
  is simply unset, indistinguishable from a query someone forgot to wrap
  in `withUser()` — fixed with a sentinel id that `asAdmin()` must set on
  purpose. See the update note added to ADR-004 and CLAUDE.md → "Easy
  mistakes to make here".
- **`SALES_NON_OBJECT_EXEMPT`** (found in the 2026-09-26 audit, not
  fixed then): added to `RESULT_KEYS` and `calculator.ts`.
- **`file-parser.ts` didn't match the verified format.** Invented
  columns (`DESCUENTO`, `ESTADO`, `NUMERO_COMPROBANTE`), missing
  `RAZON_SOCIAL_EMISOR`. It dragged along two bugs: `ingestion-service.ts`
  checked the access key's consistency against the wrong column
  (`COMPROBANTE`, the voucher type, instead of `SERIE_COMPROBANTE`), and
  `parseDate` didn't strip the time from `FECHA_EMISION` on issued
  vouchers, silently invalidating the date.
- `requiresManualReview` had a second list of "standard" voucher types
  that didn't match the real whitelist in `ingestion-service.ts`
  (ADR-010) — two sources of truth for the same decision. Unified into
  one.

### Undecided
- `docs/guides/coding-guidelines.md` calls for raw SQL for the
  proportionality factor; the domain calculates it in pure TypeScript,
  which is what ADR-001 requires in order to test the engine without a
  database. The guide was left uncorrected — see `NEXT_STEPS.md`.

## [2026-10-01] Authentication wired up

### Added
- NextAuth v5 with the `Credentials` provider (email + password,
  `bcryptjs`, JWT session) — `src/lib/auth.ts`,
  `src/app/api/auth/[...nextauth]/route.ts`. `src/lib/session.ts`
  provides a shared `getCurrentUserId()` that replaces the stub each
  `actions.ts` had separately.
- `/login` and `/register` screens (`src/app/[locale]/(auth)/`).
- `src/proxy.ts` redirects any route under `/periodos/` to `/login`
  without a session.
- `prisma/seed.ts`: seeds the plans (`plans`) — it didn't exist, even
  though `package.json` already pointed `db:seed` at that file.
  `db:reset` now runs it automatically at the end.

### Fixed
- **Registration could never complete.** `users.plan_code` is an FK to
  `plans.code`, and `plans` had no rows. Resolved by the new seed.
- **The authentication middleware never ran.** Two causes, both silent
  (no error at all, the protected route simply rendered without
  redirecting): `middleware.ts` was at the project root, but with a
  `src/` directory Next.js only recognizes it at `src/middleware.ts`;
  and Next.js 16 renamed the whole mechanism to `proxy.ts`
  (`middleware.ts` is now deprecated). Moved to `src/proxy.ts` with the
  function exported as `proxy`.

Verified end to end against the real database: registration, login via
NextAuth's real endpoint (`/api/auth/callback/credentials`), a session
with `user.id` populated, and the four period screens responding 200
with a taxpayer and a period created by hand for the test (still no
taxpayer creation screen — see `NEXT_STEPS.md`).

## [2026-10-02] Period lock (ADR-013, second mechanism)

### Added
- Trigger on `invoices_received`/`invoices_issued`
  (`prisma/migrations/20261001000000_add_period_lock/`) that rejects
  INSERT, UPDATE, and DELETE when `tax_periods.locked_at` is set. It
  lives in Postgres, like the `classification_events` immutability
  trigger, so no administrative query can bypass it. Verified against
  the real database: all three operations are blocked with the period
  closed and work again after reopening it.

### Fixed
- `lockPeriod()` and `reopenPeriod()` weren't logging any event.
  ADR-013 explicitly requires that reopening be logged. Both actions now
  write an event to `classification_events`.

### Verified (no code changes)
- The block on the proportionality factor when there are no sales (zero
  denominator) was already resolved in `proportionality.ts` —
  `NEXT_STEPS.md` had it listed as pending by mistake. The only thing
  still open is an external question (what the SRI portal expects in
  field 563 in that case), already marked `[VERIFICAR]` in
  `formulario-104.md`.

## [2026-10-02] Documentation: from pre-code specs to documentation of the real thing

With the MVP working end to end, the documents written *before* any code
existed stopped being the correct reference — they described an intent,
not what was built, and had diverged on several real points (schema
conventions, routes, Server Actions vs. REST API routes). This entry
replaces those documents with others that describe what the app does
today.

### Removed
- `docs/mvp-scope.md` — pre-build acceptance criteria; its still-valid
  content now lives in `README.md` (what it does) and `NEXT_STEPS.md`
  (what's left out).
- `docs/site/screens/` (5 specs + README) — "before building it" screen
  contracts. Replaced by `docs/guides/code-flow.md`, which describes the
  real routes, Server Actions, and behavior of the four screens built.
- `docs/LOCAL-DEVELOPMENT.md` — merged into `GETTING_STARTED.md`. Having
  two startup documents was the root cause of the `docker-compose.yml`
  bug fixed on 2026-09-24; a single quickstart file keeps it from
  happening again.

### Changed
- `docs/guides/code-flow.md` rewritten entirely: a real walkthrough of
  the four screens (ingestion, issued sales, reconciliation, pre-filing)
  with routes, Server Actions, and file names as they actually exist,
  not as planned. Includes what's missing (taxpayer creation, form
  administration, cascade tiers 2/3).
- `docs/data-model.md` rewritten to match `prisma/schema.prisma`
  exactly — previously only the `uuidv7()` line had been corrected, the
  rest still described the pre-reconciliation design (table/field names
  that no longer exist, missing tables). It also documents
  `taxpayers.created_by`, which isn't in the original design (see the
  2026-09-30 entry).
- `docs/guides/coding-guidelines.md`: fixed the "raw SQL for
  aggregations" instruction (the domain calculates them in pure
  TypeScript, intentionally, per ADR-001); the testing section now says
  there's no test runner configured instead of describing a convention
  (`tests/domain/`, etc.) that never existed.
- `README.md`: status updated from "MVP being defined" to what actually
  works today; the stack table separates what's in use from what's
  planned (AI, Sentry, deployment aren't implemented yet).
- `CLAUDE.md`: the required context no longer points to
  `docs/mvp-scope.md` (removed) but to `docs/guides/code-flow.md`.
- `NEXT_STEPS.md`: removed every already-resolved item (they remain in
  this changelog's history, not duplicated there). Only open decisions,
  work to build, and pending normative verification remain.

## [2026-10-03] `.env.local` now loads itself; no more exporting it by hand

`npx prisma migrate dev`, `npm run db:seed`, `npm run db:reset`, and
`npm run seed:test-taxpayer` required `export $(cat .env.local | xargs)`
before running, because none of them go through the `.env.local`
auto-load that `next dev` has. Compared against the `comprobify-web`
pattern (which doesn't need this step): its `prisma.config.ts` and its
scripts (`db-reset.js`, `seed.js`) load `.env.local` themselves with
`dotenv`.

### Added
- `dotenv` as a dev dependency.
- `prisma.config.ts` now calls `dotenv`'s `config({ path: '.env.local' })`
  before `defineConfig(...)` — works for everything that goes through
  the Prisma CLI (`migrate`, `studio`, etc.), without touching the
  `package.json` scripts.

### Fixed
- **The same pattern doesn't work for `prisma/seed.ts` or
  `scripts/seed-test-taxpayer.ts`.** Both import `src/lib/db.ts`, which
  builds its Postgres `Pool` on load. esbuild (the compiler behind
  `tsx`) hoists every `require` generated from an `import` to the top of
  the compiled file, regardless of where the `import` statements
  appeared in the source — so an `import { config } from 'dotenv';
  config(...)` written *before* the `import` of `db.ts` still ends up
  executing *after* it, because both `require`s already got hoisted to
  the top. `db.ts` ended up reading `process.env.DATABASE_URL` as
  `undefined`, and Postgres rejected the connection with a SASL
  authentication error that doesn't mention environment variables
  anywhere — it would have been very easy to mistake this for a
  credentials failure. Diagnosed by comparing a direct `pg` connection
  (which worked) against the same connection via the Prisma adapter
  imported from a separate file (which didn't).

  Fixed by seeding `dotenv` from outside the module graph, with
  `tsx --import dotenv/config` and `DOTENV_CONFIG_PATH=.env.local` in
  the `package.json` scripts, instead of an `import` inside the file
  itself. `scripts/db-reset.ts` didn't need the change: it doesn't
  import `db.ts` directly, and the `prisma/seed.ts` it runs as a child
  process inherits the already-correct environment from the parent
  process.
- `GETTING_STARTED.md`: removed the three
  `export $(cat .env.local | xargs)` steps — no longer needed.

## [2026-10-04] The access key was parsed with a made-up layout

Reported by the user when uploading a real received-vouchers file: every
row failed with "Check digit mismatch", "Empty digits must be 000", and
"Receiver RUC ... does not match taxpayer [UUID]".

### Fixed
- **`access-key.ts` was never verified against the real format.** Same
  type of bug already fixed in `file-parser.ts` on 2026-09-30 — this
  time in the file that was missed in that same pass. The layout of
  `parseAccessKey` didn't match the verified table in
  `docs/tax/formato-archivos-sri.md` (which ADR-009 did document
  correctly: the code was never aligned with either one):
  - The real check digit is at position 48 (the last one), not 23.
    Position 23 is the "environment" digit (1 test, 2 production) —
    which is why every error said "expected X, got 2": the code was
    reading the environment and treating it as the check digit.
  - There is no "empty digits that must be 000" field. That position
    (24-26) is actually the start of the establishment within the
    series.
  - The issuer's RUC (13 digits, position 10-22) was never extracted or
    compared against anything.
  - The check-digit calculation (mod 11, weights `7,6,5,4,3,2`) was
    correct, but it was applied to the first 23 digits instead of the
    first 48.
  Rewritten and verified against the two real keys in
  `formato-archivos-sri.md` (check digits 4 and 5, both correct with the
  fixed layout).
- **The ingestion Server Action was passing the taxpayer's UUID where
  `ingestion-service.ts` expected its RUC.** Hence the second error in
  every row: "Receiver RUC 1715824775 does not match taxpayer
  01a10783-...". Fixed to look up `taxpayer.ruc` before validating.
- **`validateIssuedRow` had no way to receive the taxpayer's RUC** — it
  passed `''` to `verifyAccessKeyConsistency`, which, with the now-fixed
  function (previously a placeholder that only checked it wasn't empty),
  would have rejected every sales row with "RUC cannot be empty". It
  hadn't shown up yet because the user had only tested received
  vouchers. Parameter added.
- **The ownership check didn't distinguish a cédula (10 digits) from a
  full RUC (13 digits).** `IDENTIFICACION_RECEPTOR` carries the cédula
  when the recipient is a natural person (documented in
  `formato-archivos-sri.md`), and the full RUC is the cédula plus a
  3-digit suffix. A direct comparison (`!==`) would have kept failing
  for the user's same file even after fixing the UUID bug. It now
  accepts both cases.

## [2026-10-04] Taxpayer and period screens; full navigation without hand-typed URLs

Until now the only way to create a taxpayer or a period was
`scripts/seed-test-taxpayer.ts` directly against the database. This
entry adds the screens that replace it and closes the navigation gap
they left.

### Added
- `src/domain/iva/activity-fingerprint.ts` —
  `computeActivityFingerprint()` (ADR-006), pure: SHA-256 hash of the
  sorted economic activities. No implementation existed even though
  `Taxpayer.activityFingerprint` was already a required field in the
  schema.
- `/[locale]/(app)/taxpayers` — the user's taxpayer list, with logout
  (`signOut()` from `next-auth/react`).
- `/[locale]/(app)/taxpayers/new` — taxpayer creation: RUC, legal name,
  optional trade name, regime, VAT periodicity, and economic activities
  (dynamic list).
- `/[locale]/(app)/[taxpayerId]/periodos` — the taxpayer's period list
  and new-period creation (year + month, monthly and VAT for now).
- `TROUBLESHOOTING.md` — environment and infrastructure errors, split
  off from `GETTING_STARTED.md` (which is now just install + quick
  walkthrough).

### Changed
- `src/proxy.ts` went from a blacklist (`pathname.includes('/periodos/')`,
  which didn't cover `/taxpayers` or `/[taxpayerId]/periodos` without a
  trailing segment) to a whitelist: every route requires a session
  except `/login`, `/register`, and the landing page. A new screen is
  protected by default.
- `/[locale]` (landing page) is no longer a list of modules with a fixed
  demo `taxpayerId`/`periodId` (`/demo/periodos/demo`). It now
  redirects: with a session to `/taxpayers`, without one to `/login`.
- The four period screens (ingestion, sales, reconciliation, pre-filing)
  had a "back" link pointing to `/` that resolved nothing. They now lead
  to the real previous screen in the hierarchy (period list, or the
  period's root).
- `GETTING_STARTED.md`: section 5 went from "create a test taxpayer via
  script" to a full walkthrough inside the application, registration
  included. "RLS verification" and "Common issues" moved to
  `TROUBLESHOOTING.md`.
- `docs/guides/code-flow.md`: new section "0. Taxpayers and periods"
  documenting the new screens and Server Actions, and the reason why
  `taxpayers` has no `DELETE` policy (deliberate, not a gap).

### Removed
- `scripts/seed-test-taxpayer.ts` and the `seed:test-taxpayer` script
  from `package.json` — replaced by the real screens.

### Finding (no code change)
- The `taxpayers` table never had an RLS policy for `DELETE` — not even
  for `is_system_admin()` — and with `FORCE ROW LEVEL SECURITY` that
  blocks the command entirely for any row, not just filters it.
  Confirmed while verifying the new flow against the real database: a
  test taxpayer ended up with no way to be deleted from the `taxap`
  role. This is consistent with ADR-013's immutable audit log, so it's
  documented in `TROUBLESHOOTING.md` instead of being treated as a bug.

## [2026-10-04] Edit taxpayer and period; navigation menu

### Added
- `/[locale]/(app)/[taxpayerId]/editar` — taxpayer editing (legal name,
  trade name, regime, periodicity, activities); the same form used for
  creation (`taxpayers/taxpayer-form.tsx`, now shared between
  `taxpayers/new` and this screen).
- `updateTaxpayer()` (`[taxpayerId]/actions.ts`) — recalculates
  `activityFingerprint` the same way `createTaxpayer()` does; a
  duplicate RUC returns `RUC_IN_USE`, excluding the taxpayer itself from
  the check.
- `updatePeriodStatus()` and `deletePeriod()`
  (`[taxpayerId]/periodos/actions.ts`): manual `DRAFT ↔ UNDER_REVIEW`
  transition with an event in `classification_events` (ADR-013), and
  deleting a period only if it's in `DRAFT` and has no vouchers loaded.
- `src/app/[locale]/(app)/layout.tsx` — a persistent menu (app name +
  logout) across the whole authenticated application. No shared layout
  existed before this; every screen built its own header.
- `src/app/[locale]/(app)/[taxpayerId]/layout.tsx` — a secondary strip
  with the legal name and links to "Periods" / "Edit taxpayer" for
  everything hanging off a taxpayer.

### Changed
- `src/components/logout-button.tsx` — relocated from
  `taxpayers/logout-button.tsx`; now used by the app layout, not the
  taxpayer list screen.
- "Reopen period" button added to `predeclaracion-client.tsx`: the
  `reopenPeriod()` function had existed since the period lock (the
  2026-10-02 entry in this changelog) but no button called it.
- `taxpayers/page.tsx` and `[taxpayerId]/periodos/page.tsx` lost their
  ad hoc headers (title + logout, or a back link with the legal name) —
  the two new layouts cover that role now.

### Finding (no code change)
- While verifying `updatePeriodStatus()`/`deletePeriod()` against the
  real database, a period with at least one event in
  `classification_events` turned out to be undeletable even with
  Postgres's superuser role — this isn't RLS (which the superuser
  bypasses), it's the trigger `reject_classification_event_mutation()`
  (`prisma/migrations/20260930113100_add_rls/migration.sql`), which
  rejects `DELETE`/`UPDATE` on that table with no exception. The audit
  log really is append-only. Documented in `TROUBLESHOOTING.md`: for
  disposable test data, avoid status transitions that generate an event
  if you need to be able to clean them up afterward.

## [2026-10-04] Period step bar: full forward and back navigation

### Fixed
- **A period's root screen had no link to ingestion, sales, or
  reconciliation.** Once a period was created, those three screens were
  only reachable by typing the URL by hand — exactly what this series of
  changes set out to eliminate. None of the four period screens had a
  way to jump to another one besides "one step back" either: the only
  link was "← Back" to the root.

### Added
- `period-step-nav.tsx` — a tab bar with the period's four steps
  (Ingestion, Issued sales, Reconciliation, Pre-filing) in order, the
  current one highlighted, each linked directly to the other three.
  Mounted on the four screens (`ingesta/page.tsx`, `ventas/page.tsx`,
  `conciliacion/page.tsx`, the period's root), replacing each one's
  single "← Back" link.
- `PeriodNav` namespace in `messages/es.json` with the bar's four short
  labels.

## [2026-10-04] Misaligned period month; sidebar menu; administration module

### Fixed
- **A period created as August displayed as July.**
  `TaxPeriod.periodStart` is `@db.Date`; Prisma reads it back as UTC
  midnight. Both the periods screen (`periodos-client.tsx`) and the
  sales table (`ventas-table.tsx`, for `issueDate`) were reading that
  date with **local**-time getters
  (`getMonth`/`getFullYear`/`toLocaleDateString` with no fixed
  timezone) — in any timezone behind UTC (Ecuador, UTC-5), UTC midnight
  on day 1 falls on the previous night in local time, and the displayed
  month rolled back one. Fixed to `getUTCMonth`/`getUTCFullYear` and
  `toLocaleDateString(locale, { timeZone: 'UTC' })`. `createPeriod()`
  also switched to building `periodStart`/`periodEnd` with
  `Date.UTC(...)` instead of `new Date(year, month-1, 1)`, so it doesn't
  depend on the timezone of the process running the server. Verified on
  this same machine (`America/Guayaquil`, UTC-5, the real condition that
  caused the bug): an August 2026 period created with the fixed logic
  renders as "Agosto 2026" on the real screen.

### Added
- **Persistent sidebar menu** (`src/components/app-sidebar.tsx`, mounted
  by `(app)/layout.tsx`): "My taxpayers" always, "Administration" only
  for `role = ADMIN`. Always visible on desktop; sliding panel with a
  hamburger on mobile. Replaces the single-line header that already
  existed — that header itself already rendered correctly (confirmed
  with a real session against the existing build); the change is about
  prominence and information, not a menu missing from the code.
- **Modals** (`src/components/ui/dialog.tsx`, first use in the project,
  a wrapper around `radix-ui`): creating a period, creating a form
  version, adding a field, and loading a VAT rate all moved from inline
  forms to modals.
- **Administration module** (`/admin/formularios`, `/admin/tasas`,
  ADR-015): the admin uploads a PDF (only for its `sha256` — there's no
  automatic text extraction yet, every field is entered by hand),
  publishes form versions, and loads VAT rates that require a source
  and verification date before saving. `asAdmin()` had gone unused
  anywhere in `src/app` for months — this is its first real screen.
- `requireAdmin()` (`src/lib/session.ts`): re-queries `users.role`
  against the database on every call, doesn't trust the session JWT's
  claim (which can keep saying `ADMIN` after someone loses the role, as
  long as the token hasn't expired).
- `scripts/seed-admin-user.ts` + `npm run seed:admin`: creates or
  promotes an account to `ADMIN`.
- `TaxRate.source`/`verifiedAt`/`createdBy` (migration
  `add_tax_rate_source`): the schema had nowhere to record where a
  loaded rate came from, even though CLAUDE.md already required that
  traceability. `/admin/tasas` won't let the form submit without both
  fields.

### No change (deliberate)
- **No VAT rate ended up loaded.** Both rows in
  [`docs/tax/tasas-iva.md`](docs/tax/tasas-iva.md) remain `[VERIFICAR]`
  — CLAUDE.md forbids filling in a `[VERIFICAR]` from memory, so
  `/admin/tasas` ships empty on purpose.
- **`result_mappings` still isn't calculated.** ADR-015's 4-tier cascade
  isn't implemented; publishing a form leaves its `form_fields` ready
  but nothing connects them yet to the domain's result keys.

## [2026-10-04] Automatic extraction of the form's PDF

### Added
- `src/services/forms/pdf-field-extractor.ts` —
  `extractCandidateFields()`, pure (ADR-001): plain-text heuristics over
  what `pdf-parse` extracts from the PDF's text layer. Groups runs of 1
  to 3 consecutive code-value pairs and assigns them to `SINGLE` /
  `GROSS+NET` / `GROSS+NET+TAX` based on position, following the form's
  fixed column order ("VALOR BRUTO · VALOR NETO · IMPUESTO GENERADO").
  Verified against the real sample PDF: the 10 codes already documented
  in [`formulario-104.md`](docs/tax/formulario-104.md) (401/411/421,
  500/510/520, 502/512/522, 563) come out with the correct code and
  column type.
- `createFormVersionDraft()` now runs that extraction over the uploaded
  PDF and preloads the draft's candidate `form_fields` —
  `addFormField()`/`removeFormField()` remain available to correct any
  row before publishing, which ADR-015 requires regardless of how good
  the extraction is.
- New dependency: `pdf-parse` (wraps `pdfjs-dist`, pure text extraction
  in Node).

### Fixed (before reaching a commit)
- The first version of each field's name-search window took **all the
  text from the previous field onward**, with no limit. For the first
  row on page 1 that included the header block carrying the taxpayer's
  identity (RUC, legal name) — in a real test against the sample PDF,
  that name and RUC ended up written into `form_fields.label` before
  the bug was caught and the test row deleted from the database. Fixed
  to take at most the 2 lines immediately preceding each code, plus an
  explicit list of header lines to ignore (`Identificación:`, `Razón
  Social`, `CÓDIGO VERIFICADOR`, etc.) — it's never trusted that the PDF
  won't bring something similar again later on.

### No change (deliberate)
- Extraction is still plain-text heuristics; it doesn't use each text
  block's real position on the page. Formulas printed inside a cell
  (e.g. "482-484", "x 563") can produce a row with the wrong code or
  column; lines wrapped across two rows can lose the first half of the
  name. This is exactly the kind of error the admin's mandatory review
  exists to catch — see `NEXT_STEPS.md` for the position-based
  alternative.

## [2026-10-04] Card redesign, icon top bar, and a wizard for empty periods

### Added
- **`PeriodOverview`** (`period-overview.tsx`): four large cards with
  the period's steps (Ingestion, Sales, Reconciliation, Pre-filing), the
  first one marked "start here". `page.tsx` shows it instead of
  `PreDeclaracionClient` when the period has no vouchers yet —
  previously, a freshly created period landed straight on an empty
  results view with the factor blocked, which read as broken rather
  than empty.
- Cards on `/taxpayers` and `/[taxpayerId]/periodos` redesigned: a
  2-column grid, an icon next to the name (`Building2`/`Calendar`),
  RUC/regime/periodicity as a `Badge` instead of plain text, and icon
  buttons (`SquarePen` edit, `Trash2` delete) instead of text links. The
  main name/icon is still a `<Link>`; the secondary controls are its
  siblings, never nested inside it (a `<button>` inside an `<a>` is
  invalid HTML).
- `[taxpayerId]/layout.tsx`: the top strip moved from text links to
  icon buttons (the same visual language as the cards), with `bg-card`
  + shadow instead of the previous flat `bg-muted`.

### No change
- Taxpayer creation/editing remains a full page, not a modal — it has
  too many fields (variable-length economic activities) for a dialog.
