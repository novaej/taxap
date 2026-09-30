import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getPendingSales } from './actions';
import { VentasTable } from './ventas-table';

export default async function VentasPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('VentasEmitidas');
  const common = await getTranslations('Common');
  const sales = await getPendingSales(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted-foreground hover:underline">
        ← {common('back')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <VentasTable
        sales={sales.map((s) => ({
          id: s.id,
          series: s.series,
          issueDate: s.issueDate,
          total: s.total.toString(),
          salesTreatment: s.salesTreatment,
        }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
      />
    </div>
  );
}
