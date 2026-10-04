import { getTranslations } from 'next-intl/server';
import { Building2, Calendar, SquarePen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMyTaxpayers } from './actions';

export default async function TaxpayersPage() {
  const t = await getTranslations('Taxpayers');
  const taxpayers = await getMyTaxpayers();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

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
          <div className="grid gap-4 sm:grid-cols-2">
            {taxpayers.map((taxpayer) => (
              <Card key={taxpayer.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <Link href={`/${taxpayer.id}/periodos`} className="min-w-0 flex-1 group">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <CardTitle className="truncate text-base group-hover:underline">
                        {taxpayer.businessName}
                      </CardTitle>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/${taxpayer.id}/periodos`} title={t('periodsLink')}>
                      <Button variant="outline" size="icon-sm" aria-label={t('periodsLink')}>
                        <Calendar className="size-4" />
                      </Button>
                    </Link>
                    <Link href={`/${taxpayer.id}/editar`} title={t('navEdit')}>
                      <Button variant="outline" size="icon-sm" aria-label={t('navEdit')}>
                        <SquarePen className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {t('ruc')}: {taxpayer.ruc}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{t(`regimeOptions.${taxpayer.regime}`)}</Badge>
                    <Badge variant="outline">{t(`periodicityOptions.${taxpayer.ivaPeriodicity}`)}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
