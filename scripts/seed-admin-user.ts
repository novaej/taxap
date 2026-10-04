/**
 * Crea (o promueve a ADMIN) la cuenta que va a administrar el sistema:
 * subir/publicar el formulario 104 y cargar tasas de IVA verificadas. El
 * admin es del sistema, no de un contribuyente (ADR-015) -- no ve datos de
 * contribuyentes ni interviene en resultados.
 *
 * Uso:
 *   npm run seed:admin -- correo@ejemplo.com "contraseña-segura"
 *
 * Si la cuenta ya existe, solo la promueve a ADMIN (no toca su contraseña).
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email) {
    console.error('Uso: npm run seed:admin -- correo@ejemplo.com "contraseña-segura"');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`${email} ya es ADMIN.`);
      return;
    }
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`${email} promovido a ADMIN.`);
    return;
  }

  if (!password || password.length < 8) {
    console.error('La cuenta no existe todavía: hace falta una contraseña de al menos 8 caracteres para crearla.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Cuenta ADMIN creada: ${user.email}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
