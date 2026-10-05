import { getTranslations } from 'next-intl/server';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { PeriodStepNav } from './period-step-nav';

export default async function PeriodLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const nav = await getTranslations('PeriodNav');
  const periods = await getTranslations('Periods');

  const userId = await getCurrentUserId();
  const period = await withUser(userId, (tx) =>
    tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } })
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">
        {periods(`months.${period.periodStart.getUTCMonth() + 1}`)} {period.periodStart.getUTCFullYear()}
      </h1>
      <PeriodStepNav
        taxpayerId={taxpayerId}
        periodId={periodId}
        labels={{
          overview: nav('overview'),
          ingesta: nav('ingesta'),
          ventas: nav('ventas'),
          conciliacion: nav('conciliacion'),
          predeclaracion: nav('predeclaracion'),
        }}
      />
      {children}
    </div>
  );
}
