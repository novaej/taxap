'use client';

import { cn } from 'cn';
import { LayoutGrid } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

const STEPS = ['ingesta', 'ventas', 'conciliacion', 'predeclaracion'] as const;

type PeriodStep = (typeof STEPS)[number];

/**
 * The step bar for the four period screens. Rendered once by the period
 * layout; it derives the current step from the URL and hides itself on
 * the period's landing page, where the overview cards are the navigation.
 */
export function PeriodStepNav({
  taxpayerId,
  periodId,
  labels,
}: {
  taxpayerId: string;
  periodId: string;
  labels: Record<PeriodStep, string> & { overview: string };
}) {
  const pathname = usePathname();
  const base = `/${taxpayerId}/periodos/${periodId}`;
  if (pathname === base) return null;

  const current = pathname.slice(base.length + 1).split('/')[0];

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b text-sm">
      <Link
        href={base}
        title={labels.overview}
        aria-label={labels.overview}
        className="-mb-px border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground"
      >
        <LayoutGrid className="size-4" />
      </Link>
      {STEPS.map((step, i) => (
        <Link
          key={step}
          href={`${base}/${step}`}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2',
            step === current
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {i + 1}. {labels[step]}
        </Link>
      ))}
    </nav>
  );
}
