import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LogoutButton } from '@/components/logout-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Common');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/taxpayers" className="text-lg font-bold">
            {t('appName')}
          </Link>
          <LogoutButton label={t('logout')} />
        </div>
      </header>
      {children}
    </div>
  );
}
