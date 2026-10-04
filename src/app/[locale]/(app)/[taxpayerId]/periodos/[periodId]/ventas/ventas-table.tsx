'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { markSalesTreatment } from './actions';
import type { SalesTreatment } from '@prisma/client';

interface SaleRow {
  id: string;
  series: string;
  issueDate: Date;
  total: string; // Decimal serialized
  salesTreatment: SalesTreatment;
}

const ZERO_RATE_DESTINATIONS: SalesTreatment[] = [
  'ZERO_NO_CREDIT',
  'ZERO_WITH_CREDIT',
  'EXPORT_GOODS',
  'EXPORT_SERVICES',
  'NON_OBJECT_EXEMPT',
];

export function VentasTable({
  sales,
  taxpayerId,
  periodId,
}: {
  sales: SaleRow[];
  taxpayerId: string;
  periodId: string;
}) {
  const t = useTranslations('VentasEmitidas');
  const common = useTranslations('Common');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDestination, setBulkDestination] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const taxed = sales.filter((s) => s.salesTreatment === 'TAXED');
  const zeroRate = sales.filter((s) => s.salesTreatment !== 'TAXED');
  const unmarked = zeroRate.filter((s) => s.salesTreatment === 'UNCLASSIFIED');

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function applyBulk() {
    if (!bulkDestination || selected.size === 0) return;
    startTransition(async () => {
      await markSalesTreatment(
        Array.from(selected),
        bulkDestination as SalesTreatment,
        taxpayerId,
        periodId
      );
      setSelected(new Set());
      setBulkDestination('');
    });
  }

  function markSingle(id: string, treatment: string) {
    startTransition(async () => {
      await markSalesTreatment([id], treatment as SalesTreatment, taxpayerId, periodId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          {t('taxedSales')}: <strong>{taxed.length}</strong> · {t('assignedAutomatically')}
        </div>
        <div>
          {t('zeroRatedSales')}: <strong>{zeroRate.length}</strong>
          {unmarked.length > 0 && (
            <span className="text-destructive"> · {t('missingCount', { count: unmarked.length })}</span>
          )}
        </div>
      </div>

      {zeroRate.length > 0 && (
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b p-3">
            <Checkbox
              checked={selected.size === zeroRate.length && zeroRate.length > 0}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(zeroRate.map((s) => s.id)) : new Set())
              }
            />
            <span className="text-sm">{t('selectAll')}</span>
            <span className="text-sm text-muted-foreground">{t('markSelectedAs')}:</span>
            <Select value={bulkDestination} onValueChange={setBulkDestination}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t('chooseDestination')} />
              </SelectTrigger>
              <SelectContent>
                {ZERO_RATE_DESTINATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`destinations.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyBulk} disabled={isPending || selected.size === 0}>
              {common('confirm')}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('series')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('total')}</TableHead>
                <TableHead>{t('destination')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeroRate.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(sale.id)}
                      onCheckedChange={() => toggle(sale.id)}
                    />
                  </TableCell>
                  <TableCell>{sale.series}</TableCell>
                  <TableCell>
                    {new Date(sale.issueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' })}
                  </TableCell>
                  <TableCell>{sale.total}</TableCell>
                  <TableCell>
                    <Select
                      value={sale.salesTreatment === 'UNCLASSIFIED' ? '' : sale.salesTreatment}
                      onValueChange={(v) => markSingle(sale.id, v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder={t('chooseDestination')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ZERO_RATE_DESTINATIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {t(`destinations.${d}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sale.salesTreatment === 'UNCLASSIFIED' && (
                      <span className="ml-2 text-xs text-destructive">{t('unmarked')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {unmarked.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{t('factorBlockedNotice')}</AlertDescription>
        </Alert>
      )}

      <Link href={`/${taxpayerId}/periodos/${periodId}/conciliacion`}>
        <Button variant="link">{t('continueToConciliation')}</Button>
      </Link>
    </div>
  );
}
