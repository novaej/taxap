/**
 * Crea un contribuyente y un período de prueba para una cuenta ya
 * registrada, y los vincula. No hay pantalla de alta de contribuyente
 * todavía (docs/site/screens/README.md la deja fuera de esta ronda), así
 * que esto es el puente manual mientras tanto.
 *
 * Uso:
 *   npx tsx scripts/seed-test-taxpayer.ts correo@ejemplo.com
 *
 * Imprime las URLs de las cuatro pantallas al terminar.
 */

import { asAdmin, withUser, prisma } from '../src/lib/db';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: npx tsx scripts/seed-test-taxpayer.ts <correo>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No existe un usuario con correo ${email}. Regístrate primero en /register.`);
    process.exit(1);
  }

  const { taxpayer, period } = await withUser(user.id, async (tx) => {
    const taxpayer = await tx.taxpayer.create({
      data: {
        ruc: `TEST${Date.now()}`.slice(0, 13).padEnd(13, '0'),
        businessName: 'Contribuyente de prueba',
        activityFingerprint: 'test-fingerprint',
        createdBy: user.id,
      },
    });
    await tx.userTaxpayer.create({ data: { userId: user.id, taxpayerId: taxpayer.id } });
    const period = await tx.taxPeriod.create({
      data: {
        taxpayerId: taxpayer.id,
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
      },
    });
    return { taxpayer, period };
  });

  const base = `http://localhost:3000/es/${taxpayer.id}/periodos/${period.id}`;
  console.log(`\nContribuyente de prueba creado para ${email}.\n`);
  console.log('Pantallas:');
  console.log(`  Ingesta:         ${base}/ingesta`);
  console.log(`  Ventas emitidas: ${base}/ventas`);
  console.log(`  Conciliación:    ${base}/conciliacion`);
  console.log(`  Pre-declaración: ${base}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
