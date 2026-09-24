# Local Development Setup

## Database Credentials

**Development database:** `taxap_dev` on `localhost:5432`

| Param | Value |
|---|---|
| Host | localhost |
| Port | 5432 |
| User | `taxap` |
| Password | `taxap_dev_password` |
| Database | `taxap_dev` |

**Connection string:**
```
postgresql://taxap:taxap_dev_password@localhost:5432/taxap_dev?schema=public
```

This is already set in `.env.local` (not committed).

## Setup Steps

### 1. PostgreSQL Container

Start the container (expects `postgres18` to already be running or available):

```bash
docker start postgres18
```

Or, if it doesn't exist, create it first:
```bash
docker run -d \
  --name postgres18 \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18-alpine
```

### 2. Database & User

Run the setup script to create the database and user:

```bash
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
```

Or create manually:
```bash
docker exec postgres18 psql -U postgres -c "
  CREATE ROLE taxap WITH LOGIN PASSWORD 'taxap_dev_password';
  CREATE DATABASE taxap_dev OWNER taxap;
  ALTER ROLE taxap CREATEDB;
"
```

### 3. Prisma Migrations

Apply migrations:

```bash
npm install --legacy-peer-deps
export $(cat .env.local | xargs)
npx prisma migrate dev
```

Verify connection:
```bash
npx prisma db execute --stdin < /dev/null
```

## Resetting the Database

To drop everything and start fresh:

```bash
docker exec postgres18 psql -U postgres -c "DROP DATABASE taxap_dev;"
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
npm run db:migrate
```

## Environment Variables

Create `.env.local` (not committed) with:

```
DATABASE_URL="postgresql://taxap:taxap_dev_password@localhost:5432/taxap_dev?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"
```

For production, generate a strong `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

## Testing Database Access

```bash
# As the taxap user
PGPASSWORD="taxap_dev_password" psql -h localhost -U taxap -d taxap_dev

# As postgres superuser
docker exec postgres18 psql -U postgres -d taxap_dev

# Via Prisma CLI
export $(cat .env.local | xargs)
npx prisma studio  # Opens a GUI
```

## Notes

- The `taxap` user has `CREATEDB` permission for Prisma's shadow database during migrations.
- Row-Level Security (RLS) is enabled on all taxpayer-owned tables ([ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md)).
- The `.env.local` file is in `.gitignore` and should never be committed.
