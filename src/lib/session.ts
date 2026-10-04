import { auth } from './auth';
import { prisma } from './db';

/**
 * The authenticated user's id, to pass to withUser()/asAdmin().
 * Throws if there's no session -- a screen's Server Actions must never
 * simulate a user or silently degrade to an unfiltered access.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }
  return session.user.id;
}

/**
 * For admin routes. Re-checks the role against `users` instead of
 * trusting the session JWT's claim -- a long-lived JWT can keep saying
 * ADMIN after someone's role is taken away; this check must not wait for
 * the token to expire or refresh.
 */
export async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'ADMIN') {
    throw new Error('Not authorized: ADMIN role required');
  }
  return userId;
}
