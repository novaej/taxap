import { getTranslations } from 'next-intl/server';
import { Building2, Calendar, SquarePen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getTaxpayer } from './actions';

export default async function TaxpayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Taxpayers');
  const taxpayer = await getTaxpayer(taxpayerId);

  return (
    <div>
      <div className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold">{taxpayer.businessName}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link href={`/${taxpayerId}/periodos`} title={t('navPeriods')}>
              <Button variant="ghost" size="icon-sm" aria-label={t('navPeriods')}>
                <Calendar className="size-4" />
              </Button>
            </Link>
            <Link href={`/${taxpayerId}/editar`} title={t('navEdit')}>
              <Button variant="ghost" size="icon-sm" aria-label={t('navEdit')}>
                <SquarePen className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
