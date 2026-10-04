import { getTranslations } from 'next-intl/server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link, redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect({ href: '/taxpayers', locale: 'es' });
  }
  const t = await getTranslations('Admin');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <Alert className="mb-6">
        <AlertDescription>{t('disclaimer')}</AlertDescription>
      </Alert>

      <nav className="mb-6 flex gap-4 border-b text-sm">
        <Link
          href="/admin/formularios"
          className="-mb-px border-b-2 border-transparent px-1 py-2 text-muted-foreground hover:text-foreground"
        >
          {t('navFormularios')}
        </Link>
        <Link
          href="/admin/tasas"
          className="-mb-px border-b-2 border-transparent px-1 py-2 text-muted-foreground hover:text-foreground"
        >
          {t('navTasas')}
        </Link>
      </nav>

      {children}
    </div>
  );
}
