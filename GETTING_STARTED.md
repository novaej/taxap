# Getting started

## Requirements

| Tool | Version |
|---|---|
| Node.js | 24.x |
| Docker | For local PostgreSQL |
| PostgreSQL | 18+ (via Docker) |

## 1. Database

The container is named `postgres18`. If it already exists, just start it:

```bash
docker start postgres18
```

If it doesn't exist yet, create it:

```bash
docker run -d \
  --name postgres18 \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18-alpine
```

Create the `taxap` user and the `taxap_dev` database:

```bash
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
```

| Parameter | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `taxap` |
| Password | `taxap_dev_password` |
| Database | `taxap_dev` |

> **The `taxap` user is not a superuser, and must never be.** PostgreSQL
> superusers bypass Row-Level Security unconditionally, even with
> `FORCE ROW LEVEL SECURITY`. A misconfigured deployment that uses the
> `postgres` user silently disables all isolation between users.
> See [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

Verify that it isn't one:

```bash
docker exec postgres18 psql -U taxap -d taxap_dev \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
# must return: f
```

The `taxap` role has `CREATEDB` permission (Prisma needs it for the shadow
database during migrations) but is not a superuser.

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Generate the auth secret:

```bash
openssl rand -base64 32
```

`.env.local` ends up looking like this (not version-controlled):

```
DATABASE_URL="postgresql://taxap:taxap_dev_password@localhost:5432/taxap_dev?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<the secret generated above>"
AI_PROVIDER="claude"
ANTHROPIC_API_KEY=""
```

`AI_PROVIDER`/`ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` if `AI_PROVIDER=openai`)
are **optional**. Without a key for the selected provider, the system runs in
no-AI mode: the cascade runs tiers 1, 2, and 4, and more vouchers fall
through to the review inbox. Nothing breaks. See [ADR-007](docs/adr/007-modo-sin-ia-y-catalogo-compartido.md).
The two providers (`src/services/ai/`) implement the same `AiClassifier`
interface, so switching one for the other is just `AI_PROVIDER` -- no code
change.

If the AI call fails with *"This API key is not scoped to a workspace"*, set
`ANTHROPIC_WORKSPACE_ID` to your workspace id (or use a workspace-scoped key).

## 3. Dependencies and schema

```bash
npm install
npm run db:migrate
npm run db:seed
```

The seed (`prisma/seed.ts`) only loads the plans (`plans`) — needed so
`users.plan_code` has something to point to when registering an account.
**It does not load normative data** (VAT rates, field map): any value
without a source and verification date is marked `[VERIFICAR]` and is not
loaded into the system (CLAUDE.md → "Normative values"). Those are loaded
manually once verified — see [`docs/tax/`](docs/tax/).

## 4. Start it up

```bash
npm run dev
```

http://localhost:3000 → redirects to `/es` (the only locale for now).

## 5. Full walkthrough, from zero to pre-filing

Everything from here on happens inside the application — no URL is typed
by hand beyond the initial one.

1. **Registration and login.** Visiting `http://localhost:3000` redirects
   to `/es/login` (no session). Go to `/es/register`, create the account,
   then log back in. With a session, the landing page redirects to
   `/es/taxpayers`.
2. **Create a taxpayer.** On `/es/taxpayers` (empty the first time), click
   "Register the first one" → form: RUC (13 digits), legal name, regime,
   VAT periodicity, and economic activities. The MVP only calculates a
   pre-filing for **monthly** periodicity; with any other periodicity the
   taxpayer is registered but without calculation yet.
3. **Create a period.** After creating the taxpayer, you return to the
   list; "View periods →" leads to `/es/[taxpayerId]/periodos`. There,
   "+ New period" and choose year/month. Each period starts out as
   "Draft".
4. **Enter the period.** Clicking the created period leads to its root
   screen (pre-filing), with links to the three flow screens:
   - **Ingestion** — upload an SRI `.txt` voucher file (received or
     issued). See the expected format in
     [`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).
   - **Issued sales** — mark the destination of sales with `IVA = 0%`
     (export, 0% with/without credit entitlement, not subject/exempt).
     The proportionality factor is not calculated while any remain
     unmarked.
   - **Reconciliation** — classify purchases with `IVA > 0` (tax credit,
     cost or expense, or exclude), by supplier.
5. **Pre-filing.** Back at the period's root, the calculated results (no
   form field yet, see [`NEXT_STEPS.md`](NEXT_STEPS.md)) and the option
   to mark the period as filed.

For details on what each Server Action does and why, see
[`docs/guides/code-flow.md`](docs/guides/code-flow.md). For errors during
this walkthrough, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

## 6. Administration (optional)

To upload Form 104 or load a VAT rate you need an `ADMIN` account —
normal registration (step 1) always creates `INDIVIDUAL` accounts.

Set `ADMIN_EMAIL` (and `ADMIN_PASSWORD`, only needed the first time) in
`.env.local`, then run the seed:

```bash
npm run db:seed
```

If `ADMIN_EMAIL` already exists (for example, the account you used in
step 1), this promotes it to `ADMIN` without touching its password. If
it doesn't exist yet, it's created with `ADMIN_PASSWORD`. Either way
it's safe to run again — re-seeding never duplicates the account. Log in
with that account and the sidebar will show "Administration".

On `/admin/formularios`, "New version" uploads a PDF — only to compute
its fingerprint, it isn't saved — and creates a draft. Fields are added
there by hand (there's no automatic PDF extraction yet) and then
published. On `/admin/tasas`, loading a rate requires its source and
verification date; none is loaded by default because none has been
verified yet (`docs/tax/tasas-iva.md`).

## Database commands

| Command | What it does |
|---|---|
| `npm run db:migrate` | Applies pending migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seeds the plans, and the `ADMIN_EMAIL` account if that env var is set (`prisma/seed.ts`) |
| `npm run db:reset` | Drops everything in `public` (tables, types, functions) and migrates + seeds again. Blocked if `NODE_ENV=production`. |

Direct database access, if needed:

```bash
# As the app's user
PGPASSWORD="taxap_dev_password" psql -h localhost -U taxap -d taxap_dev

# As superuser (for administrative tasks, never for the app)
docker exec postgres18 psql -U postgres -d taxap_dev

# Prisma Studio
npx prisma studio
```

## Test data

The SRI's `.txt` files are **never version-controlled** — they are real
tax data. Place them in `samples/`, which is in `.gitignore`.

For the expected format, see
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).

## Resetting from scratch

```bash
npm run db:reset
```

Manual equivalent if needed:

```bash
docker exec postgres18 psql -U postgres -c "DROP DATABASE taxap_dev;"
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
npm run db:migrate
npm run db:seed
```

To verify that RLS works and for common errors during setup or the
walkthrough, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
