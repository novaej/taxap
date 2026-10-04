import { cn } from 'cn';
import { Link } from '@/i18n/navigation';

const STEPS = ['ingesta', 'ventas', 'conciliacion', 'predeclaracion'] as const;

export type PeriodStep = (typeof STEPS)[number];

function stepHref(taxpayerId: string, periodId: string, step: PeriodStep) {
  const base = `/${taxpayerId}/periodos/${periodId}`;
  return step === 'predeclaracion' ? base : `${base}/${step}`;
}

/**
 * Barra de pasos del período: navegación completa hacia adelante y atrás
 * entre las cuatro pantallas (antes solo existía un enlace "← Volver" a la
 * raíz, y la raíz misma no tenía ningún enlace hacia las otras tres).
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
