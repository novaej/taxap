import { getTranslations } from 'next-intl/server';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { getPeriodResults } from '../actions';
import { PreDeclaracionClient } from '../predeclaracion-client';

export default async function PreDeclaracionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('PreDeclaracion');

  const userId = await getCurrentUserId();
  const period = await withUser(userId, (tx) =>
    tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } })
  );
  const results = await getPeriodResults(taxpayerId, periodId);

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">{t('title')}</h2>
      <PreDeclaracionClient
        initialResults={results.map((r) => ({ key: r.resultKey, value: r.value.toString() }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
        isFiled={period.status === 'FILED'}
      />
    </div>
  );
}
