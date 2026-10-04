import { getTranslations } from 'next-intl/server';
import { getPendingSales } from './actions';
import { VentasTable } from './ventas-table';
import { PeriodStepNav } from '../period-step-nav';

export default async function VentasPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('VentasEmitidas');
  const nav = await getTranslations('PeriodNav');
  const sales = await getPendingSales(taxpayerId, periodId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PeriodStepNav
        taxpayerId={taxpayerId}
        periodId={periodId}
        current="ventas"
        labels={{
          ingesta: nav('ingesta'),
          ventas: nav('ventas'),
          conciliacion: nav('conciliacion'),
          predeclaracion: nav('predeclaracion'),
        }}
      />

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
