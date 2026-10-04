import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMyTaxpayers } from './actions';
import { LogoutButton } from './logout-button';

export default async function TaxpayersPage() {
  const t = await getTranslations('Taxpayers');
  const taxpayers = await getMyTaxpayers();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <LogoutButton label={t('logout')} />
      </div>

      {taxpayers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground">{t('emptyState')}</p>
            <Link href="/taxpayers/new">
              <Button>{t('emptyStateCta')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Link href="/taxpayers/new">
              <Button>{t('newButton')}</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {taxpayers.map((taxpayer) => (
              <Card key={taxpayer.id}>
                <CardHeader>
                  <CardTitle>{taxpayer.businessName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div>
                      {t('ruc')}: {taxpayer.ruc}
                    </div>
                    <div>
                      {t('regime')}: {t(`regimeOptions.${taxpayer.regime}`)}
                    </div>
                    <div>
                      {t('periodicity')}: {t(`periodicityOptions.${taxpayer.ivaPeriodicity}`)}
                    </div>
                  </div>
                  <Link
                    href={`/${taxpayer.id}/periodos`}
                    className="mt-3 inline-block text-sm text-primary hover:underline"
                  >
                    {t('periodsLink')}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
