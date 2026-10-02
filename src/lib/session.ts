import { auth } from './auth';

/**
 * El id del usuario autenticado, para pasar a withUser()/asAdmin().
 * Lanza si no hay sesión -- las Server Actions de cada pantalla no deben
 * simular un usuario ni degradar en silencio a un acceso sin filtrar.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticado');
  }
  return session.user.id;
}
