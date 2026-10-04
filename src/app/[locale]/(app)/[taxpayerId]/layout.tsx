import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
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
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2 text-sm">
          <span className="font-medium">{taxpayer.businessName}</span>
          <Link
            href={`/${taxpayerId}/periodos`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {t('navPeriods')}
          </Link>
          <Link
            href={`/${taxpayerId}/editar`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {t('navEdit')}
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
