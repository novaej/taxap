import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { AppSidebar } from '@/components/app-sidebar';
import { BackBar } from '@/components/back-bar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Common');
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        appName={t('appName')}
        logoutLabel={t('logout')}
        taxpayersLabel={t('navTaxpayers')}
        adminLabel={t('navAdmin')}
        isAdmin={isAdmin}
        userEmail={session?.user?.email ?? ''}
      />
      <main className="min-w-0 flex-1">
        <BackBar label={t('back')} />
        {children}
      </main>
    </div>
  );
}
