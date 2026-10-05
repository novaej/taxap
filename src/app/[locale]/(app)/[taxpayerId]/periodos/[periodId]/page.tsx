import { getTranslations } from 'next-intl/server';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { PeriodOverview } from './period-overview';

export default async function PeriodOverviewPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('PreDeclaracion');
  const nav = await getTranslations('PeriodNav');

  const userId = await getCurrentUserId();
  const invoiceCount = await withUser(userId, async (tx) => {
    const [received, issued] = await Promise.all([
      tx.invoiceReceived.count({ where: { taxPeriodId: periodId } }),
      tx.invoiceIssued.count({ where: { taxPeriodId: periodId } }),
    ]);
    return received + issued;
  });

  return (
    <PeriodOverview
      taxpayerId={taxpayerId}
      periodId={periodId}
      hasData={invoiceCount > 0}
      labels={{
        heading: t('overviewHeading'),
        ingestaTitle: nav('ingesta'),
        ingestaDescription: t('overviewIngestaDescription'),
        ventasTitle: nav('ventas'),
        ventasDescription: t('overviewVentasDescription'),
        conciliacionTitle: nav('conciliacion'),
        conciliacionDescription: t('overviewConciliacionDescription'),
        predeclaracionTitle: nav('predeclaracion'),
        predeclaracionDescription: t('overviewPredeclaracionDescription'),
        startHere: t('overviewStartHere'),
      }}
    />
  );
}
