/**
 * Prisma 7 config: connection URL for CLI commands (migrate, db push, studio).
 * The running app never reads this file — it connects via the driver adapter
 * constructed in src/lib/db.ts.
 *
 * Loads .env.local itself (like comprobify-web's prisma.config.ts) so these
 * commands work from a plain shell -- no need to `export $(cat .env.local
 * | xargs)` first. `next dev` already auto-loads .env.local on its own;
 * this is only for commands that run outside Next.js.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
