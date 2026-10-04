import { getTranslations } from 'next-intl/server';
import { getPurchasesByStatus } from './actions';
import { ConciliacionTable } from './conciliacion-table';
import { PeriodStepNav } from '../period-step-nav';

export default async function ConciliacionPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('Conciliacion');
  const nav = await getTranslations('PeriodNav');
  const purchases = await getPurchasesByStatus(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PeriodStepNav
        taxpayerId={taxpayerId}
        periodId={periodId}
        current="conciliacion"
        labels={{
          ingesta: nav('ingesta'),
          ventas: nav('ventas'),
          conciliacion: nav('conciliacion'),
          predeclaracion: nav('predeclaracion'),
        }}
      />

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
