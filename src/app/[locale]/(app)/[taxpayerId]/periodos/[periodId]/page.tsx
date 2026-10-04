import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { getPeriodResults } from './actions';
import { PreDeclaracionClient } from './predeclaracion-client';
import { PeriodStepNav } from './period-step-nav';
import { PeriodOverview } from './period-overview';

export default async function PreDeclaracionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('PreDeclaracion');
  const common = await getTranslations('Common');
  const nav = await getTranslations('PeriodNav');

  const userId = await getCurrentUserId();
  const { period, invoiceCount } = await withUser(userId, async (tx) => {
    const [period, receivedCount, issuedCount] = await Promise.all([
      tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } }),
      tx.invoiceReceived.count({ where: { taxPeriodId: periodId } }),
      tx.invoiceIssued.count({ where: { taxPeriodId: periodId } }),
    ]);
    return { period, invoiceCount: receivedCount + issuedCount };
  });
  const results = await getPeriodResults(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/${taxpayerId}/periodos`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← {common('back')}
      </Link>

      <PeriodStepNav
        taxpayerId={taxpayerId}
        periodId={periodId}
        current="predeclaracion"
        labels={{
          ingesta: nav('ingesta'),
          ventas: nav('ventas'),
          conciliacion: nav('conciliacion'),
          predeclaracion: nav('predeclaracion'),
        }}
      />

      {invoiceCount === 0 ? (
        <PeriodOverview
          taxpayerId={taxpayerId}
          periodId={periodId}
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
      ) : (
        <>
          <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
          <PreDeclaracionClient
            initialResults={results.map((r) => ({ key: r.resultKey, value: r.value.toString() }))}
            taxpayerId={taxpayerId}
            periodId={periodId}
            isFiled={period.status === 'FILED'}
          />
        </>
      )}
    </div>
  );
}
