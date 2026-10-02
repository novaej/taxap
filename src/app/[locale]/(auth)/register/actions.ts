'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export interface RegisterResult {
  success: boolean;
  error?: 'EMAIL_IN_USE' | 'UNKNOWN';
}

/**
 * Alta de usuario. No crea contribuyente -- esa pantalla está deferida a
 * propósito (NEXT_STEPS.md -> Por construir). `users` no tiene RLS, así que
 * esto corre contra `prisma` directo.
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
