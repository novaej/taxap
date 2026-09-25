/**
 * Prisma 7 config: connection URL for CLI commands (migrate, db push, studio).
 * The running app never reads this file — it connects via the driver adapter
 * constructed in src/lib/db.ts.
 */

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
