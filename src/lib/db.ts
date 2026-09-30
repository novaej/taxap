/**
 * Database client with Row-Level Security (RLS) enforcement.
 * ADR-004: All queries to taxpayer-owned data must filter by current user's access.
 *
 * Usage:
 *   const invoices = await withUser(userId, (tx) =>
 *     tx.invoicesReceived.findMany(...)
 *   );
 *
 * `withUser` runs the SET of `app.current_user_id` and the callback's queries
 * inside a single `$transaction`, which pins them to the same physical
 * connection. Without that, a pooled connection could run the SET on one
 * connection and the query on another, silently dropping the RLS filter —
 * the exact failure this file exists to prevent.
 *
 * `asAdmin()` sets an explicit sentinel id, never just RESET — a merely
 * *unset* session variable must fail closed (see the RLS migration), so an
 * accidental direct query is indistinguishable from a bug, not mistaken for
 * a deliberate admin call.
 */

const SYSTEM_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pgPool: Pool;
};

const pool =
  globalForPrisma.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}

/**
 * Run queries scoped to a specific user, with RLS enforced.
 * Call this at the start of any handler that needs data for a specific user.
 *
 * Example:
 *   export async function GET(req: Request) {
 *     const userId = getUserIdFromSession(); // Your auth logic
 *     const invoices = await withUser(userId, (tx) =>
 *       tx.invoicesReceived.findMany(...)
 *     );
 *   }
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_user_id = '${userId.replace(/'/g, "''")}'`
    );
    return fn(tx);
  });
}

/**
 * For Admin-only operations (e.g., importing form definitions).
 * No user isolation; full database access.
 */
export async function asAdmin<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_user_id = '${SYSTEM_ADMIN_ID}'`
    );
    return fn(tx);
  });
}
