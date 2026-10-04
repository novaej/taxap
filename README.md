# taxap

Tax-calculation assistant for Ecuador (SRI). Speeds up preparing the VAT
filing from the voucher files that the taxpayer downloads from the SRI
portal.

> **taxap does not file tax returns or replace professional judgment.**
> It produces calculation drafts that must be reviewed and validated by the
> responsible party before being submitted to the SRI. See [ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md).

## Who it's for

| Profile | Role in the system | Taxpayers |
|---|---|---|
| Individual who handles their own accounting | `INDIVIDUAL` | 1 |
| Independent accountant or firm | `ACCOUNTANT` | N, depending on plan |

## What it does

1. **Ingestion** — upload of the SRI's `.txt` files for received and issued
   vouchers, with integrity validation and deduplication by access key.
2. **Classification** — a deterministic cascade (learned rules → shared
   catalog → optional AI → manual review) that assigns each purchase its
   VAT treatment.
3. **Reconciliation** — an inbox where the user approves, reassigns, or
   excludes whatever the system couldn't resolve with confidence. Each
   decision becomes a rule.
4. **Pre-filing** — totals by Form 104 field, with a breakdown traceable
   down to the individual invoice.

## Status

Functional MVP for monthly VAT (Form 104): registration, file ingestion,
purchase classification, sales marking, result calculation, and period
locking all work end to end against a real database. Still no taxpayer
creation screen (the stopgap is `scripts/seed-test-taxpayer.ts`) nor form
administration — see [`NEXT_STEPS.md`](NEXT_STEPS.md) for the exact status.

Income Tax, Withholdings, and ATS are accounted for in the data model but
are out of scope for the MVP.

## Stack

In use today:

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| i18n | next-intl (`es` only for now) |
| Database | PostgreSQL 18+ (Docker locally) |
| Data access | Prisma 7 + `@prisma/adapter-pg` |
| VAT calculation | Pure domain in TypeScript/`Decimal.js` — no aggregation SQL |
| Isolation | Row-Level Security per user |
| Authentication | NextAuth v5 (credentials) + bcryptjs |

Planned, not implemented yet (see [`NEXT_STEPS.md`](NEXT_STEPS.md)):

| Layer | Technology |
|---|---|
| AI (tier-3 classification) | Claude Haiku 4.5 via Batch API; Opus 5 for escalation |
| Observability | Sentry |
| Deployment | Not yet decided |

## Documentation

| Document | Content |
|---|---|
| [`GETTING_STARTED.md`](GETTING_STARTED.md) | Getting the project running locally, from zero |
| [`docs/guides/code-flow.md`](docs/guides/code-flow.md) | How the app works today, screen by screen |
| [`docs/data-model.md`](docs/data-model.md) | Commented schema |
| [`docs/adr/`](docs/adr/) | Architecture decisions and their rationale |
| [`docs/tax/`](docs/tax/) | Tax reference and SRI file format |
| [`docs/guides/coding-guidelines.md`](docs/guides/coding-guidelines.md) | Conventions for writing code here |
| [`CLAUDE.md`](CLAUDE.md) | Rules for AI assistants |
| [`NEXT_STEPS.md`](NEXT_STEPS.md) | Open items and pending decisions |
| [`CHANGELOG.md`](CHANGELOG.md) | Change history |
