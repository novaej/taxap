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
import { createPeriod, updatePeriodStatus, deletePeriod } from './actions';

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
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

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

  async function handleStatusChange(periodId: string, status: string) {
    setRowErrors((prev) => ({ ...prev, [periodId]: '' }));
    const result = await updatePeriodStatus(taxpayerId, periodId, status as 'DRAFT' | 'UNDER_REVIEW');
    if (!result.success) {
      setRowErrors((prev) => ({ ...prev, [periodId]: t('statusUpdateError') }));
      return;
    }
    setPeriods((prev) => prev.map((p) => (p.id === periodId ? { ...p, status } : p)));
  }

  async function handleDelete(periodId: string) {
    if (!window.confirm(t('deleteConfirm'))) return;

    const result = await deletePeriod(taxpayerId, periodId);
    if (!result.success) {
      const message = result.error === 'HAS_DATA' ? t('hasDataError') : t('notDraftError');
      setRowErrors((prev) => ({ ...prev, [periodId]: message }));
      return;
    }
    setPeriods((prev) => prev.filter((p) => p.id !== periodId));
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
              <Card key={period.id}>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <Link
                    href={`/${taxpayerId}/periodos/${period.id}`}
                    className="flex-1 hover:underline"
                  >
                    <CardTitle className="text-base">
                      {t(`months.${monthNum}`)} {date.getFullYear()}
                    </CardTitle>
                  </Link>
                  <div className="flex items-center gap-2">
                    {period.status === 'FILED' ? (
                      <Badge variant="outline">{t('statusOptions.FILED')}</Badge>
                    ) : (
                      <Select
                        value={period.status}
                        onValueChange={(status) => handleStatusChange(period.id, status)}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">{t('statusOptions.DRAFT')}</SelectItem>
                          <SelectItem value="UNDER_REVIEW">
                            {t('statusOptions.UNDER_REVIEW')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {period.status === 'DRAFT' && (
                      <Button variant="outline" size="sm" onClick={() => handleDelete(period.id)}>
                        {common('delete')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {rowErrors[period.id] && (
                  <CardContent className="pt-0">
                    <Alert variant="destructive">
                      <AlertDescription>{rowErrors[period.id]}</AlertDescription>
                    </Alert>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
