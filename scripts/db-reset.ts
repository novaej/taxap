/**
 * Development database reset — drops all application tables, then re-runs
 * every migration from scratch.
 *
 * Usage:
 *   npm run db:reset
 *
 * NEVER runs in production.
 *
 * We drop tables inside `public` rather than `DROP SCHEMA public CASCADE`:
 * PostgreSQL assigns schema ownership to pg_database_owner, not the app
 * role, but the app role does own the tables it created via migrations.
 */

import { Pool } from 'pg';
import { execSync } from 'child_process';

if (process.env.NODE_ENV === 'production') {
  console.error('db:reset must not run in production (NODE_ENV=production).');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it from .env.local first:');
  console.error('  export $(cat .env.local | xargs)');
  process.exit(1);
}

async function reset() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Dropping all tables in schema public...');
    await client.query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$
    `);

    // Enum types are separate objects from tables — dropping tables doesn't
    // drop them, and a stale enum left behind causes Prisma to report drift
    // on the next migration even though every table is gone.
    console.log('Dropping leftover enum types...');
    await client.query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN (
          SELECT typname FROM pg_type
          WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
        ) LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$
    `);
    console.log('Dropping leftover functions...');
    await client.query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN (
          SELECT p.oid::regprocedure AS sig
          FROM pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace
        ) LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
        END LOOP;
      END $$
    `);
    console.log('Tables, types, and functions dropped.');
  } finally {
    client.release();
    await pool.end();
  }

  console.log('Running migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
}

reset().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
