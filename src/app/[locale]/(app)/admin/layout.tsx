import { getTranslations } from 'next-intl/server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/session';
import { AdminNav } from './admin-nav';

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

      <AdminNav
        items={[
          { href: '/admin/formularios', label: t('navFormularios') },
          { href: '/admin/tasas', label: t('navTasas') },
        ]}
      />

      {children}
    </div>
  );
}
