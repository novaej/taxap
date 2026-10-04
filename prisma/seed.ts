/**
 * Datos mínimos para que la app arranque: planes (FK de users.plan_code).
 *
 * Esto NO incluye datos normativos (tax_rates, form_versions) -- esos llevan
 * fuente y fecha de verificación (CLAUDE.md -> "Valores normativos") y no se
 * cargan de memoria. Ver docs/tax/tasas-iva.md: ninguna tasa está verificada
 * todavía, así que no hay nada que sembrar ahí.
 *
 * No carga .env.local aquí mismo: `../src/lib/db` construye su Pool al
 * importarse, y esbuild (vía tsx) sube todos los `require` generados por
 * `import` al tope del archivo compilado, por encima de cualquier otra
 * instrucción -- así que un `import dotenv` + `config()` escrito antes de
 * este `import` de todas formas corre *después* de que `db.ts` ya leyó
 * `process.env.DATABASE_URL`. El `npm run db:seed` de package.json precarga
 * dotenv con `--import dotenv/config`, que sí corre antes de que se cargue
 * ningún módulo del proyecto.
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
