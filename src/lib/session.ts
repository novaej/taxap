import { auth } from './auth';
import { prisma } from './db';

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

/**
 * Para rutas de administración. Vuelve a consultar el rol contra `users`
 * en vez de confiar en el claim del JWT de sesión -- un JWT de larga
 * duración puede seguir diciendo ADMIN después de que alguien le quite el
 * rol a ese usuario; esta comprobación no debe esperar a que el token
 * expire o se refresque.
 */
export async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'ADMIN') {
    throw new Error('No autorizado: se requiere rol ADMIN');
  }
  return userId;
}
