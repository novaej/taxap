import { getTranslations } from 'next-intl/server';
import { getPurchasesByStatus } from './actions';
import { ConciliacionTable } from './conciliacion-table';

export default async function ConciliacionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('Conciliacion');
  const purchases = await getPurchasesByStatus(taxpayerId, periodId);

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">{t('title')}</h2>

      <ConciliacionTable
        purchases={purchases.map((p) => ({
          id: p.id,
          supplierRuc: p.supplierRuc,
          supplierName: p.supplierName,
          total: p.total.toString(),
          ivaCategory: p.ivaCategory,
          processingStatus: p.processingStatus,
          hasVat: p.vatAmount.gt(0),
        }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
      />
    </div>
  );
}
