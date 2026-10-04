/**
 * Minimal data for the app to start: plans (FK of users.plan_code).
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

import { prisma } from '../src/lib/db';

async function main() {
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

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
