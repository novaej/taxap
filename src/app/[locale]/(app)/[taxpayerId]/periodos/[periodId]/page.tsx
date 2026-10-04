import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { getPeriodResults } from './actions';
import { PreDeclaracionClient } from './predeclaracion-client';

export default async function PreDeclaracionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('PreDeclaracion');
  const common = await getTranslations('Common');

  const userId = await getCurrentUserId();
  const period = await withUser(userId, (tx) =>
    tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } })
  );
  const results = await getPeriodResults(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/${taxpayerId}/periodos`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← {common('back')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <PreDeclaracionClient
        initialResults={results.map((r) => ({ key: r.resultKey, value: r.value.toString() }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
        isFiled={period.status === 'FILED'}
      />
    </div>
  );
}
