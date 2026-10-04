# How taxap works

A real walk-through of a period, screen by screen, with the routes and
Server Actions exactly as they exist in the code today. For the *why*
behind each decision, see the linked ADRs — this document describes the
*what*, not the *why*.

---

## Accounts and access

NextAuth v5, email and password (`src/lib/auth.ts`), JWT session,
`bcryptjs` for hashing.

- **Register** — `/[locale]/register` → `registerUser()` creates the user
  directly against `prisma` (the `users` table has no RLS). It doesn't
  create any taxpayer.
- **Login** — `/[locale]/login`, `signIn()` from `next-auth/react` on the
  client.
- **Logout** — button at the bottom of `AppSidebar`
  (`src/components/logout-button.tsx`), visible throughout the app,
  `signOut()` from `next-auth/react`.
- **Route protection** — `src/proxy.ts` is an allowlist, not a
  denylist: every route requires a session except `/login`, `/register`,
  and the landing page (`/`, which just redirects). This way a new screen
  is protected by default without anyone having to remember to add it to
  a list. Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`;
  with a `src/` directory, it also only recognizes the file inside
  `src/`.
- **Role** — `users.role` (`INDIVIDUAL | ACCOUNTANT | ADMIN`) travels in
  the session JWT (`src/lib/auth.ts`, `jwt`/`session` callbacks) so the
  sidebar knows whether to show the admin link without a separate query.
  **That claim is never used to authorize an actual action** — a JWT is
  long-lived and could still say `ADMIN` after someone loses the role;
  `requireAdmin()` (`src/lib/session.ts`) re-queries `users` directly
  before letting any `/admin` Server Action through.

## Navigation

Two nested layouts under `(app)`, plus a sidebar component:

- **`AppSidebar`** (`src/components/app-sidebar.tsx`, client) — mounted
  by `(app)/layout.tsx`, wraps every authenticated screen. Always visible
  on desktop (`md:block`); on mobile it's a sliding panel with a
  hamburger button (local `useState`, no state library). Links: "My
  taxpayers" always, "Administration" only if
  `session.user.role === 'ADMIN'`. Highlights the active section by
  comparing `usePathname()`.
- **`[taxpayerId]/layout.tsx`** — wraps everything under a given taxpayer
  (`periodos`, `editar`). Secondary strip: business name + two icon
  buttons ("Periods" = `Calendar`, "Edit taxpayer" = `SquarePen`, each
  with `title`/`aria-label` since they carry no visible text). Calls
  `getTaxpayer()` once per request; each child page may query it again
  if it needs more than the name (there's no memoization between layout
  and page yet).

The cards on `/taxpayers` and `/[taxpayerId]/periodos` follow the
same pattern: a `<Link>` wraps the name/icon (primary navigation, one
click enters the taxpayer or the period) and the secondary controls —
icon buttons to edit, a `Select`, or a delete button — sit as siblings of
the `<Link>` within the same `CardHeader`, never nested inside it (a
`<button>` inside an `<a>` is invalid HTML and breaks keyboard focus).

**Modals instead of inline forms** — creating a period
(`periodos-client.tsx`), a form version and adding a field
(`admin/formularios/...`), and loading a VAT rate (`admin/tasas/...`)
all use `src/components/ui/dialog.tsx` (a wrapper around `radix-ui`'s
`Dialog`, the first use of it in the project). Modal was chosen over a
full page for short actions on a small form that don't need their own
URL; creating/editing a taxpayer stays a full page because it has too
many fields (a variable-length list of economic activities) for a modal.

Within a period, the four screens (`ingesta`, `ventas`,
`conciliacion`, the period root for pre-filing) share
`period-step-nav.tsx`: a tab bar with the four steps in order, the
current one highlighted, each one a direct link to the other three. It
replaces the single "← Back" link that existed before — that link could
only go up one level, and **the period root had no link to the other
three screens at all**: once a period was created, there was no way to
reach ingestion/sales/reconciliation without typing the URL by hand. The
step bar doesn't live in any layout because the four routes don't share
a common segment in the Next.js tree (`periodId` sits under `periodos/`,
but `ingesta`/`ventas`/`conciliacion` are siblings of the period root,
not its children) — each page imports and renders it on its own.

## 0. Taxpayers and periods

**Routes:** `/[locale]/(app)/taxpayers`, `/[locale]/(app)/taxpayers/new`,
`/[locale]/(app)/[taxpayerId]/editar`, `/[locale]/(app)/[taxpayerId]/periodos`
**Server Actions:** `getMyTaxpayers()`, `createTaxpayer()`
(`taxpayers/actions.ts`); `getTaxpayer()`, `updateTaxpayer()`
(`[taxpayerId]/actions.ts`); `getTaxpayerPeriods()`, `createPeriod()`,
`updatePeriodStatus()`, `deletePeriod()` (`[taxpayerId]/periodos/actions.ts`)

The landing page (`/[locale]`) redirects: to `/taxpayers` with a session,
to `/login` without one. There are no more demo routes with fixed ids.

- `/taxpayers` lists the user's taxpayers (via `user_taxpayers`,
  filtered by RLS) and leads to `/taxpayers/new`, `/[taxpayerId]/periodos`,
  or `/[taxpayerId]/editar`.
- `createTaxpayer()`/`updateTaxpayer()` compute `activityFingerprint` with
  `computeActivityFingerprint()` (`domain/iva/activity-fingerprint.ts` —
  a hash of the sorted economic activities, ADR-006) every time
  activities are saved. **Revalidating `supplier_rules` when the
  fingerprint changes (ADR-006) is not implemented** — the field is
  recalculated and saved, nothing more. A duplicate RUC returns
  `RUC_IN_USE` in both actions, not an unhandled exception. The form
  (`taxpayer-form.tsx`, shared between create and edit) doesn't let the
  RUC be edited beyond format validation; if it changes, uniqueness is
  rechecked excluding the taxpayer itself.
- `/[taxpayerId]/periodos` lists the taxpayer's periods and allows
  creating a new one (year + month → `periodStart`/`periodEnd`, monthly
  and IVA for now). The actual uniqueness constraint is
  `(taxpayerId, taxType, periodStart)`, not year/month as such.
  - **Changing status** (`updatePeriodStatus`) only moves between
    `DRAFT ↔ UNDER_REVIEW` and writes an event to `classification_events`
    (ADR-013, rule 6). `FILED` is deliberately left out — it's
    `lockPeriod()`/`reopenPeriod()` (pre-filing screen, see
    section 4) because those two also set/clear `locked_at`, which
    triggers Postgres's voucher lock.
  - **Deleting a period** (`deletePeriod`) only works in `DRAFT` status
    and with no vouchers (`invoices_received`/`invoices_issued` at
    zero) — if either condition fails, it returns `NOT_DRAFT` or
    `HAS_DATA` without touching anything. It's the only deletion path
    that exists for a period; there's no equivalent for a taxpayer
    (see below).

**Taxpayers cannot be deleted.** The `taxpayers` table only has RLS
policies for `SELECT`/`INSERT`/`UPDATE` — no `DELETE`, not even for
`is_system_admin()`. With `FORCE ROW LEVEL SECURITY`, the absence of a
policy for a command blocks that command entirely, not just filters it.
This is deliberate (consistent with the immutable audit log of ADR-013):
if it's needed in the future, it's a new product decision, not a missing
`DELETE` to add. `classification_events` goes a step further: a Postgres
trigger rejects `DELETE`/`UPDATE` on that table unconditionally, for any
role, superuser included — it's not RLS (which the superuser does
ignore), it's an actual trigger. Any period with at least one event (any
status transition) becomes permanently undeletable, and with it its
taxpayer. See
[`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md).

## Data access

Every query on taxpayer tables goes through `withUser(userId, fn)`
(`src/lib/db.ts`), which sets `app.current_user_id` with `SET LOCAL`
inside a single `$transaction` — never as two separate calls, because
with a connection pool the `SET` and the query could land on different
connections and RLS would silently be lost. `asAdmin(fn)` exists for
userless paths (seeding, admin tasks) and sets an explicit sentinel id,
never `RESET` — an unset variable must fail closed, not open. See
[ADR-004](../adr/004-rls-por-usuario-con-prisma.md).

## 1. Ingestion

**Route:** `/[locale]/(app)/[taxpayerId]/periodos/[periodId]/ingesta`
**Server Action:** `uploadSourceFiles()` (`ingesta/actions.ts`)
**Layers:** page → `services/ingestion` (parsing and validation) →
`domain/iva/access-key` (access-key consistency) → `withUser()`

One file at a time for now (the SRI's multi-file upload layout —
`samples/`, one file per day — still has no UI).

Per file:
1. Compute `sha256` and detect the file type from the header columns
   (`detectFileType` — 12 columns with `RUC_EMISOR` = received, 8 with
   `COMPROBANTE` = issued). See
   [`../tax/formato-archivos-sri.md`](../tax/formato-archivos-sri.md).
2. Register it in `source_files`.

Per row (`ingestionService.validateReceivedRow`/`validateIssuedRow`):
1. Decompose the `CLAVE_ACCESO` and cross-check it against date, type,
   RUC, and series
   ([ADR-009](../adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)).
2. Verify the voucher belongs to the period's taxpayer
   (received: `IDENTIFICACION_RECEPTOR`; issued: the RUC embedded in the
   access key).
3. Verify `FECHA_EMISION` falls within the period.
4. Verify the type against the allowlist in
   `services/ingestion/ingestion-service.ts` →
   `VOUCHER_TYPE_WHITELIST` ([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)).
   An unknown type → warning, not rejection; it falls to manual review in
   the classification step.
5. Insert via `upsert` on `(taxpayer_id, access_key)` — re-uploading the
   same file duplicates nothing.

**Once finished, vouchers are saved with
`processing_status = UNCLASSIFIED`.** If anything fails afterward,
nothing is lost
([ADR-011](../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)).

## 2. Issued sales

**Route:** `.../ventas`
**Server Actions:** `getPendingSales()`, `markSalesTreatment()`
(`ventas/actions.ts`)

The issued-invoices file doesn't indicate why a sale has `IVA = 0`
(export, 0% with or without the right to credit, non-object/exempt), nor
does it carry the customer or a description. This screen is where the
user resolves that ambiguity.

- Sales with `IVA > 0` become `TAXED` automatically.
- Sales with `IVA = 0` start as `UNCLASSIFIED`, and the user marks each
  one (or several at once) with its actual destination. Each mark calls
  `markSalesTreatment()`, which updates `invoices_issued.sales_treatment`
  and writes an event to `classification_events`
  ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

The proportionality factor (pre-filing screen) is not calculated while
any sale remains `UNCLASSIFIED`.

## 3. Reconciliation

**Route:** `.../conciliacion`
**Server Actions:** `getPurchasesByStatus()`, `classifyPeriod()`,
`applyManualClassification()` (`conciliacion/actions.ts`)

Only vouchers with `IVA > 0` enter here
([ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md)).

**`classifyPeriod()`** — step 2 of ingestion
([ADR-011](../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)): groups
`UNCLASSIFIED` vouchers by supplier and runs the
`classificationCascade.classify()` cascade
([ADR-005](../adr/005-clasificacion-en-cascada.md)):

```
┌─ Level 1 ── supplier_rules (taxpayer, supplier) — not revoked
│             ↓ no match
├─ Level 2 ── shared catalog (requires 3+ in agreement) — []  not implemented yet, ADR-007
│             ↓ no match
├─ Level 3 ── AI — null  not implemented yet, ADR-007
│             ↓ no match
└─ Level 4 ── manual review queue (processing_status = REQUIRES_MANUAL_REVIEW)
```

A voucher type outside the allowlist within the group sends the whole
supplier to manual review without going through the cascade
(`requiresManualReview()`, which uses the single boolean ingestion
already computed — there's no separate second list of "standard types").

**`applyManualClassification()`** — manual classification, single or in
bulk:
1. Updates `iva_category` and `processing_status = PROCESSED`.
2. Writes an event to `classification_events`.
3. Creates or updates the supplier rule (level 1) — the feedback loop:
   what's corrected today applies on its own (no AI) in the following
   period.

## 4. Pre-filing

**Route:** `/[locale]/(app)/[taxpayerId]/periodos/[periodId]` (the period
root)
**Server Actions:** `computePeriodResults()`, `lockPeriod()`,
`reopenPeriod()` (the period's `actions.ts`)

**This route doesn't always show results.** `page.tsx` counts
`invoices_received` + `invoices_issued` for the period; at zero, it
renders `PeriodOverview` (`period-overview.tsx`) instead of
`PreDeclaracionClient` — four large cards, one per step of the flow, the
first ("Ingestion") marked as the starting point. Before this, a
newly created period landed directly on an empty-results view with the
factor blocked, which read as broken rather than empty. As soon as the
period has at least one voucher, it goes back to showing the regular
results view.

**`computePeriodResults()`** calls `calculatePeriodResults()`
(`src/domain/iva/calculator.ts`) over the period's vouchers — pure
domain logic, no aggregation SQL, tested without a database
([ADR-001](../adr/001-nextjs-monolito-con-capa-de-dominio.md)) — and
saves each result to `period_results`. The domain produces **stable
keys** (`SALES_TAXED`, `PURCHASES_WITH_CREDIT`, `PROPORTIONALITY_FACTOR`…)
and knows nothing about form field codes
([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).

The proportionality factor
(`src/domain/iva/proportionality.ts`) counts exports and 0% sales with
the right to credit in the numerator; a taxpayer who only exports
services has a factor of `1.0000`
([`../tax/formulario-104.md`](../tax/formulario-104.md)). It is
blocked — with an explicit reason, never a made-up number — if there are
unmarked sales or if there are no sales in the period (zero
denominator).

**The result → form field relationship (`result_mappings`,
ADR-015) is not implemented yet:** the admin screen that imports the PDF
and computes that relationship doesn't exist
([`NEXT_STEPS.md`](../../NEXT_STEPS.md)). Today the screen shows the
domain's keys directly, not the field code or its official name.

**`lockPeriod()`** sets `tax_periods.status = FILED` and `locked_at`, and
writes an event. A Postgres trigger
(`prisma/migrations/*_add_period_lock/`) rejects INSERT, UPDATE, and
DELETE on `invoices_received`/`invoices_issued` for the period while it's
locked — it lives in the database, not the application, so no path can
bypass it ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

**`reopenPeriod()`** clears `status`/`locked_at` and also writes an
event — the reopening itself is logged, not just whatever gets edited
afterward. Exposed in the UI (`predeclaracion-client.tsx`) as the
"Reopen period" button, visible only when `isFiled` — the function used
to exist before any button called it.

## 5. Administration

**Routes:** `/[locale]/(app)/admin/formularios`,
`/[locale]/(app)/admin/formularios/[formVersionId]`,
`/[locale]/(app)/admin/tasas`
**Server Actions:** all in `admin/actions.ts`, all behind
`requireAdmin()`, all running with `asAdmin()` — never `withUser()`,
because the admin doesn't own any taxpayer ([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).

The admin belongs to the system: they upload/publish the form and load
rates, but don't see taxpayer data or intervene in results — the
disclaimer in `admin/layout.tsx` says so explicitly on screen.

- **`createFormVersionDraft()`** uploads a PDF, computes its `sha256`
  (`crypto`, same as `uploadSourceFiles()` in ingestion) and creates a
  `FormVersion` in `DRAFT`. **The PDF is never stored** — neither the
  file nor its content, only the hash, exactly as ADR-015 requires.
  It also tries to extract its fields with
  `extractCandidateFields()` (`src/services/forms/pdf-field-extractor.ts`,
  pure, no I/O — it receives the text already extracted by `pdf-parse`
  as a string): a plain-text heuristic with no real position/layout data
  behind it, so it gets the common case right (code + name +
  gross/net/tax on a single line) and fails predictably on the rest
  (wrapped lines, formulas printed in the cell itself like
  "482-484"). Deliberately conservative about how much text behind it is
  taken as the field's name (at most 2 lines) — not purely for
  precision: the first lines of each page repeat the taxpayer's identity
  (RUC, business name), and a longer search window pulled that straight
  into `form_fields.label` in real tests against the sample PDF. A
  scanned PDF with no text layer, or any read failure, leaves the draft
  with no fields — never a hard error. All rows, whether generated or
  not, stay editable and deletable on the next screen before publishing
  (ADR-015: admin review is never optional, extraction quality doesn't
  change that).
- **`addFormField()`** adds a field (code, official name, section,
  column type) by hand, one at a time, while the version is still
  `DRAFT`. The schema itself (`@@unique([formVersionId, code])`) rejects
  a repeated code — `addFormField` catches that Postgres error and
  translates it to `DUPLICATE_CODE`; there's no application-level
  duplicate check because the database already guarantees it.
- **`publishFormVersion()`** requires at least one field and sets
  `status = PUBLISHED` + `publishedAt`. Once published, a version isn't
  edited — the UI stops showing the add/remove-field controls. Fixing
  something means a new version, not an edit (the same principle as
  ADRs: never rewritten, replaced).
- **`createTaxRate()`** requires `source` and `verifiedAt` on the form
  itself — it can't be submitted without both (CLAUDE.md → "Normative
  values"). **No rate is loaded at all**: no row in
  [`docs/tax/tasas-iva.md`](../tax/tasas-iva.md) is verified yet, so
  `/admin/tasas` exists but its table stays empty in any real
  environment.
- **`result_mappings` isn't computed anywhere yet** — the 4-level
  cascade from ADR-015 (previous version → attributes → AI →
  no field) is not implemented. Publishing a form leaves its
  `form_fields` ready, but nothing connects them yet to the domain's
  result keys (`NEXT_STEPS.md`).

## Still to be built

See [`NEXT_STEPS.md`](../../NEXT_STEPS.md) for the full list. The most
relevant items for understanding the current state:

- Automatic PDF extraction and computing `result_mappings`
  (ADR-015) — without this, pre-filing still shows no field codes even
  when a form has already been published.
- Shared catalog (level 2) and AI (level 3) of the classification
  cascade — today `classifyPeriod()` passes them as empty/null; only
  levels 1 and 4 are active.
