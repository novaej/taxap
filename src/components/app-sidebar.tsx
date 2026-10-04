'use client';

import { useState } from 'react';
import { cn } from 'cn';
import { Building2, Menu, ShieldCheck, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { LogoutButton } from '@/components/logout-button';

interface AppSidebarProps {
  appName: string;
  logoutLabel: string;
  taxpayersLabel: string;
  adminLabel: string;
  isAdmin: boolean;
  userEmail: string;
}

export function AppSidebar({
  appName,
  logoutLabel,
  taxpayersLabel,
  adminLabel,
  isAdmin,
  userEmail,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isTaxpayersSection = !pathname.startsWith('/admin');
  const isAdminSection = pathname.startsWith('/admin');

  const navLinkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  const content = (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/taxpayers" className="text-lg font-bold" onClick={() => setMobileOpen(false)}>
          {appName}
        </Link>
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        <Link
          href="/taxpayers"
          className={navLinkClass(isTaxpayersSection)}
          onClick={() => setMobileOpen(false)}
        >
          <Building2 className="size-4" />
          {taxpayersLabel}
        </Link>
        {isAdmin && (
          <Link
            href="/admin/formularios"
            className={navLinkClass(isAdminSection)}
            onClick={() => setMobileOpen(false)}
          >
            <ShieldCheck className="size-4" />
            {adminLabel}
          </Link>
        )}
      </nav>

      <div className="border-t border-border px-4 py-4">
        {userEmail && (
          <p className="mb-2 truncate text-xs text-muted-foreground">{userEmail}</p>
        )}
        <LogoutButton label={logoutLabel} className="w-full" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: siempre visible */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:block">
        {content}
      </aside>

      {/* Mobile: hamburger button + sliding panel */}
      <div className="fixed top-3 left-3 z-40 md:hidden">
        {!mobileOpen && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="rounded-md border bg-background p-2 shadow-sm"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute top-0 left-0 h-full w-64 shadow-lg">{content}</aside>
        </div>
      )}
    </>
  );
}
