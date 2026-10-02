/**
 * Datos mínimos para que la app arranque: planes (FK de users.plan_code).
 *
 * Esto NO incluye datos normativos (tax_rates, form_versions) -- esos llevan
 * fuente y fecha de verificación (CLAUDE.md -> "Valores normativos") y no se
 * cargan de memoria. Ver docs/tax/tasas-iva.md: ninguna tasa está verificada
 * todavía, así que no hay nada que sembrar ahí.
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

  console.log('Planes sembrados: STARTER, PROFESSIONAL, ENTERPRISE');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
