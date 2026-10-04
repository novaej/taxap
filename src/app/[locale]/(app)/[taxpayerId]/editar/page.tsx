import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTaxpayer } from '../actions';
import { TaxpayerForm } from '../../taxpayers/taxpayer-form';

export default async function EditTaxpayerPage({
  params,
}: {
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Taxpayers');
  const taxpayer = await getTaxpayer(taxpayerId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('editTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TaxpayerForm
            mode="edit"
            taxpayerId={taxpayerId}
            initial={{
              ruc: taxpayer.ruc,
              businessName: taxpayer.businessName,
              tradeName: taxpayer.tradeName ?? '',
              regime: taxpayer.regime,
              ivaPeriodicity: taxpayer.ivaPeriodicity,
              economicActivities:
                (taxpayer.economicActivities as Array<{ code: string; description: string }>)
                  .length > 0
                  ? (taxpayer.economicActivities as Array<{ code: string; description: string }>)
                  : [{ code: '', description: '' }],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
