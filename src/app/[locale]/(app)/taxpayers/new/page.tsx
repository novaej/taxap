import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaxpayerForm } from '../taxpayer-form';

export default async function NewTaxpayerPage() {
  const t = await getTranslations('Taxpayers');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/taxpayers" className="text-sm text-muted-foreground hover:underline">
          ← {t('title')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('newTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TaxpayerForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
