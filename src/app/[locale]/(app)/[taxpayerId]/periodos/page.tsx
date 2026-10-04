import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getTaxpayer, getTaxpayerPeriods } from './actions';
import { PeriodosClient } from './periodos-client';

export default async function PeriodosPage({
  params,
}: {
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Periods');

  const taxpayer = await getTaxpayer(taxpayerId);
  const periods = await getTaxpayerPeriods(taxpayerId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/taxpayers" className="mb-4 inline-block text-sm text-muted-foreground hover:underline">
        ← {taxpayer.businessName}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <PeriodosClient
        taxpayerId={taxpayerId}
        initialPeriods={periods.map((p) => ({
          id: p.id,
          periodStart: p.periodStart.toISOString(),
          status: p.status,
        }))}
      />
    </div>
  );
}
