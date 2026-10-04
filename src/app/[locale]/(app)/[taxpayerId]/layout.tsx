import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
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
      <div className="border-b bg-muted">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="font-semibold">{taxpayer.businessName}</span>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/${taxpayerId}/periodos`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {t('navPeriods')}
          </Link>
          <Link
            href={`/${taxpayerId}/editar`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {t('navEdit')}
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
