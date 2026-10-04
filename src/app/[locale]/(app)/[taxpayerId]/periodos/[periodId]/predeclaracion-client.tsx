'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { computePeriodResults, lockPeriod, reopenPeriod } from './actions';

interface ResultRow {
  key: string;
  value: string;
}

export function PreDeclaracionClient({
  initialResults,
  taxpayerId,
  periodId,
  isFiled,
}: {
  initialResults: ResultRow[];
  taxpayerId: string;
  periodId: string;
  isFiled: boolean;
}) {
  const t = useTranslations('PreDeclaracion');
  const common = useTranslations('Common');
  const [isPending, startTransition] = useTransition();

  function recompute() {
    startTransition(async () => {
      await computePeriodResults(taxpayerId, periodId);
    });
  }

  function markFiled() {
    startTransition(() => lockPeriod(taxpayerId, periodId));
  }

  function reopen() {
    startTransition(() => reopenPeriod(taxpayerId, periodId));
  }

  const salesKeys = [
    'SALES_TAXED',
    'SALES_ZERO_NO_CREDIT',
    'SALES_ZERO_WITH_CREDIT',
    'EXPORT_GOODS',
    'EXPORT_SERVICES',
    'SALES_NON_OBJECT_EXEMPT',
  ];
  const purchaseKeys = ['PURCHASES_WITH_CREDIT', 'PURCHASES_NO_CREDIT', 'PURCHASES_ZERO_VAT'];
  const factorKeys = ['PROPORTIONALITY_FACTOR', 'CREDIT_APPLICABLE', 'VAT_NOT_CREDITED'];

  const byKey = new Map(initialResults.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant={isFiled ? 'default' : 'secondary'}>
          {isFiled ? t('formLabel') : t('draftBadge')}
        </Badge>
        <Button onClick={recompute} disabled={isPending || isFiled} size="sm" variant="outline">
          {common('save')}
        </Button>
      </div>

      <Alert>
        <AlertDescription>{common('disclaimer')}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t('salesHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {salesKeys.map((key) =>
            byKey.has(key) ? (
              <div key={key} className="flex justify-between text-sm">
                <span>{key}</span>
                <strong>{byKey.get(key)}</strong>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('purchasesHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {purchaseKeys.map((key) =>
            byKey.has(key) ? (
              <div key={key} className="flex justify-between text-sm">
                <span>{key}</span>
                <strong>{byKey.get(key)}</strong>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('factorHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byKey.has('PROPORTIONALITY_FACTOR') ? (
            factorKeys.map((key) =>
              byKey.has(key) ? (
                <div key={key} className="flex justify-between text-sm">
                  <span>{key}</span>
                  <strong>{byKey.get(key)}</strong>
                </div>
              ) : null
            )
          ) : (
            <p className="text-sm text-destructive">{t('factorBlocked')}</p>
          )}
        </CardContent>
      </Card>

      {!isFiled ? (
        <Button onClick={markFiled} disabled={isPending}>
          {t('lockPeriod')}
        </Button>
      ) : (
        <Button onClick={reopen} disabled={isPending} variant="outline">
          {t('reopenPeriod')}
        </Button>
      )}
    </div>
  );
}
