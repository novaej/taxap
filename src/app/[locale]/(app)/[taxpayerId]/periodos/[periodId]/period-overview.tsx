import { Upload, Receipt, ListChecks, FileCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface StepCard {
  key: 'ingesta' | 'ventas' | 'conciliacion' | 'predeclaracion';
  href: string;
  title: string;
  description: string;
  Icon: typeof Upload;
}

/**
 * Landing state for a period with no comprobantes yet. Dropping a brand
 * new period straight onto the results view (empty totals, factor
 * blocked) read as broken, not empty -- this points at the first real
 * step instead. `PeriodStepNav` still lets the user jump anywhere.
 */
export function PeriodOverview({
  taxpayerId,
  periodId,
  labels,
}: {
  taxpayerId: string;
  periodId: string;
  labels: {
    heading: string;
    ingestaTitle: string;
    ingestaDescription: string;
    ventasTitle: string;
    ventasDescription: string;
    conciliacionTitle: string;
    conciliacionDescription: string;
    predeclaracionTitle: string;
    predeclaracionDescription: string;
    startHere: string;
  };
}) {
  const base = `/${taxpayerId}/periodos/${periodId}`;
  const steps: StepCard[] = [
    {
      key: 'ingesta',
      href: `${base}/ingesta`,
      title: labels.ingestaTitle,
      description: labels.ingestaDescription,
      Icon: Upload,
    },
    {
      key: 'ventas',
      href: `${base}/ventas`,
      title: labels.ventasTitle,
      description: labels.ventasDescription,
      Icon: Receipt,
    },
    {
      key: 'conciliacion',
      href: `${base}/conciliacion`,
      title: labels.conciliacionTitle,
      description: labels.conciliacionDescription,
      Icon: ListChecks,
    },
    {
      key: 'predeclaracion',
      href: base,
      title: labels.predeclaracionTitle,
      description: labels.predeclaracionDescription,
      Icon: FileCheck,
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{labels.heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
          <Link key={step.key} href={step.href}>
            <Card
              className={
                i === 0
                  ? 'h-full border-primary transition-colors hover:border-primary hover:bg-accent'
                  : 'h-full transition-colors hover:border-primary hover:bg-accent'
              }
            >
              <CardHeader>
                <step.Icon className="mb-2 size-6 text-primary" />
                <CardTitle className="flex items-center gap-2 text-base">
                  {i + 1}. {step.title}
                  {i === 0 && (
                    <span className="text-xs font-normal text-primary">{labels.startHere}</span>
                  )}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
