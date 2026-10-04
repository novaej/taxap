/**
 * Creates (or promotes to ADMIN) the account that will administer the
 * system: upload/publish Form 104 and load verified IVA rates. The admin
 * belongs to the system, not to a taxpayer (ADR-015) -- they never see
 * taxpayer data or intervene in results.
 *
 * Usage:
 *   npm run seed:admin -- email@example.com "a-strong-password"
 *
 * If the account already exists, this only promotes it to ADMIN (its
 * password is left untouched).
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email) {
    console.error('Usage: npm run seed:admin -- email@example.com "a-strong-password"');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`${email} is already ADMIN.`);
      return;
    }
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`${email} promoted to ADMIN.`);
    return;
  }

  if (!password || password.length < 8) {
    console.error('That account does not exist yet: a password of at least 8 characters is required to create it.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'ADMIN' },
  });
  console.log(`ADMIN account created: ${user.email}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
