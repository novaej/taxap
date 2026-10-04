'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export interface RegisterResult {
  success: boolean;
  error?: 'EMAIL_IN_USE' | 'UNKNOWN';
}

/**
 * User sign-up. Doesn't create a taxpayer -- that's a separate step on
 * `/taxpayers/new` once the user is logged in. `users` has no RLS, so
 * this runs directly against `prisma`.
 */
export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<RegisterResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: 'EMAIL_IN_USE' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: { email, passwordHash, firstName, lastName },
    });
    return { success: true };
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
}
