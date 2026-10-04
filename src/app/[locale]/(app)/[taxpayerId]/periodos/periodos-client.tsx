'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPeriod } from './actions';

interface PeriodRow {
  id: string;
  periodStart: string;
  status: string;
}

export function PeriodosClient({
  taxpayerId,
  initialPeriods,
}: {
  taxpayerId: string;
  initialPeriods: PeriodRow[];
}) {
  const t = useTranslations('Periods');
  const common = useTranslations('Common');

  const [periods, setPeriods] = useState(initialPeriods);
  const [showForm, setShowForm] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);

    const result = await createPeriod({
      taxpayerId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });

    setIsSubmitting(false);

    if (!result.success || !result.periodId) {
      setError(result.error === 'ALREADY_EXISTS' ? t('alreadyExists') : common('loading'));
      return;
    }

    setPeriods((prev) => [
      { id: result.periodId!, periodStart: new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1).toISOString(), status: 'DRAFT' },
      ...prev,
    ]);
    setShowForm(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)}>{t('newButton')}</Button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex gap-2">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('year')} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('month')} />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`months.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {t('createButton')}
            </Button>
          </CardContent>
        </Card>
      )}

      {periods.length === 0 ? (
        <p className="text-muted-foreground">{t('emptyState')}</p>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => {
            const date = new Date(period.periodStart);
            const monthNum = date.getMonth() + 1;
            return (
              <Link key={period.id} href={`/${taxpayerId}/periodos/${period.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">
                      {t(`months.${monthNum}`)} {date.getFullYear()}
                    </CardTitle>
                    <Badge variant="outline">{t(`statusOptions.${period.status}`)}</Badge>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
