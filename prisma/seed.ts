/**
 * Everything this app needs seeded to start, in one idempotent pass:
 * plans (FK of users.plan_code), and -- only if ADMIN_EMAIL is set --
 * the one ADMIN account that can reach /admin/formularios and
 * /admin/tasas. Re-running this script, including via `npm run
 * db:reset`, must never create a duplicate: plans are upserted by their
 * `code` PK, and the admin account is looked up by `email` (@unique)
 * before deciding whether to create or just promote it.
 *
 * This does NOT include normative data (tax_rates, form_versions) -- those
 * carry a source and verification date (CLAUDE.md -> "Normative values")
 * and are never loaded from memory. See docs/tax/tasas-iva.md: no rate is
 * verified yet, so there's nothing to seed there.
 *
 * Doesn't load .env.local here: `../src/lib/db` builds its Pool on import,
 * and esbuild (via tsx) hoists every `require` generated from an `import`
 * to the top of the compiled file, above any other statement -- so an
 * `import dotenv` + `config()` written before this import still runs
 * *after* `db.ts` has already read `process.env.DATABASE_URL`.
 * package.json's `npm run db:seed` preloads dotenv with
 * `--import dotenv/config`, which does run before any project module loads.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db';

async function seedPlans() {
  await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: { code: 'STARTER', maxTaxpayers: 1, maxUsers: 1, aiIncluded: true },
  });

  await prisma.plan.upsert({
    where: { code: 'PROFESSIONAL' },
    update: {},
    create: { code: 'PROFESSIONAL', maxTaxpayers: 10, maxUsers: 1, aiIncluded: true },
  });

  await prisma.plan.upsert({
    where: { code: 'ENTERPRISE' },
    update: {},
    create: { code: 'ENTERPRISE', maxTaxpayers: 100, maxUsers: 5, aiIncluded: true },
  });

  console.log('Seeded plans: STARTER, PROFESSIONAL, ENTERPRISE');
}

/**
 * Optional: set ADMIN_EMAIL (and ADMIN_PASSWORD, only needed the first
 * time) in .env.local to get an ADMIN account on every seed/reset.
 * Without ADMIN_EMAIL this is a no-op -- most environments don't need
 * one seeded at all.
 */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      console.log(`${email} promoted to ADMIN.`);
    } else {
      console.log(`${email} is already ADMIN.`);
    }
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.error(
      `ADMIN_EMAIL is set but that account doesn't exist yet, and ADMIN_PASSWORD is missing or shorter than 8 characters.`
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
  console.log(`ADMIN account created: ${email}`);
}

async function main() {
  await seedPlans();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
