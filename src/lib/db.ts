/**
 * Database client with Row-Level Security (RLS) enforcement.
 * ADR-004: All queries to taxpayer-owned data must filter by current user's access.
 *
 * Usage:
 *   const db = await withUser(userId).prisma.invoicesReceived.findMany(...)
 *
 * This sets `app.current_user_id` in PostgreSQL session before each query,
 * triggering RLS policies that enforce data isolation.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Database wrapper that enforces RLS.
 * Call this at the start of any handler that needs data for a specific user.
 *
 * Example:
 *   export async function GET(req: Request) {
 *     const userId = getUserIdFromSession(); // Your auth logic
 *     const db = await withUser(userId);
 *     const invoices = await db.prisma.invoicesReceived.findMany(...);
 *   }
 */
export async function withUser(userId: string) {
  // Set the session variable for RLS policies
  await prisma.$executeRawUnsafe(
    `SET app.current_user_id = '${userId.replace(/'/g, "''")}'`
  );

  return {
    prisma,
    userId,
  };
}

/**
 * For Admin-only operations (e.g., importing form definitions).
 * No user isolation; full database access.
 */
export async function asAdmin() {
  // Clear the session variable so RLS policies don't filter
  await prisma.$executeRawUnsafe(`RESET app.current_user_id`);
  return { prisma };
}
