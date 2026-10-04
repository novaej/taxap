import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getPurchasesByStatus } from './actions';
import { ConciliacionTable } from './conciliacion-table';

export default async function ConciliacionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('Conciliacion');
  const common = await getTranslations('Common');
  const purchases = await getPurchasesByStatus(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/${taxpayerId}/periodos/${periodId}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← {common('back')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <ConciliacionTable
        purchases={purchases.map((p) => ({
          id: p.id,
          supplierRuc: p.supplierRuc,
          supplierName: p.supplierName,
          total: p.total.toString(),
          ivaCategory: p.ivaCategory,
          processingStatus: p.processingStatus,
        }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
      />
    </div>
  );
}
