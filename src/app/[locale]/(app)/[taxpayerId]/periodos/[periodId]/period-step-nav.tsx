import { cn } from 'cn';
import { Link } from '@/i18n/navigation';

const STEPS = ['ingesta', 'ventas', 'conciliacion', 'predeclaracion'] as const;

export type PeriodStep = (typeof STEPS)[number];

function stepHref(taxpayerId: string, periodId: string, step: PeriodStep) {
  const base = `/${taxpayerId}/periodos/${periodId}`;
  return step === 'predeclaracion' ? base : `${base}/${step}`;
}

/**
 * The period's step bar: full back-and-forth navigation across the four
 * screens (before this, there was only a "← Back" link to the root, and
 * the root itself had no link to any of the other three).
 */
export function PeriodStepNav({
  taxpayerId,
  periodId,
  current,
  labels,
}: {
  taxpayerId: string;
  periodId: string;
  current: PeriodStep;
  labels: Record<PeriodStep, string>;
}) {
  return (
    <nav className="mb-6 flex gap-1 border-b text-sm">
      {STEPS.map((step, i) => (
        <Link
          key={step}
          href={stepHref(taxpayerId, periodId, step)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2',
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
