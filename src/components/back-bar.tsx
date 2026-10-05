'use client';

import { ArrowLeft } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The logical parent of a screen, derived from the URL alone so that
 * "back" is the same on every page and never depends on browser history
 * (a deep link or a refresh would otherwise leave nowhere to go).
 * Returns null on the app's root screen.
 */
function parentPath(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 0) return null;

  if (seg[0] === 'taxpayers') return seg.length === 1 ? null : '/taxpayers';

  if (seg[0] === 'admin') {
    // /admin/formularios/{id} -> the list; the admin roots -> the app root.
    return seg.length > 2 ? `/admin/${seg[1]}` : '/taxpayers';
  }

  // /{taxpayerId}/editar | /periodos -> taxpayers
  // /{taxpayerId}/periodos/{periodId} -> periods
  // /{taxpayerId}/periodos/{periodId}/{step} -> the period overview
  if (seg.length <= 2) return '/taxpayers';
  if (seg.length === 3) return `/${seg[0]}/periodos`;
  return `/${seg[0]}/periodos/${seg[2]}`;
}

export function BackBar({ label }: { label: string }) {
  const parent = parentPath(usePathname());
  if (!parent) return null;

  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center px-4 py-2 pl-16 md:pl-4">
        <Link
          href={parent}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          {label}
        </Link>
      </div>
    </div>
  );
}
