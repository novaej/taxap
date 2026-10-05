'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { classifyPeriod, applyManualClassification } from './actions';
import type { IvaCategory, ProcessingStatus } from '@prisma/client';

interface PurchaseRow {
  id: string;
  supplierRuc: string;
  supplierName: string;
  total: string;
  ivaCategory: IvaCategory;
  processingStatus: ProcessingStatus;
}

type Tab = 'CREDIT' | 'COST_EXPENSE' | 'PENDING';

export function ConciliacionTable({
  purchases,
  taxpayerId,
  periodId,
}: {
  purchases: PurchaseRow[];
  taxpayerId: string;
  periodId: string;
}) {
  const t = useTranslations('Conciliacion');
  const common = useTranslations('Common');
  const [tab, setTab] = useState<Tab>('PENDING');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isPending, startTransition] = useTransition();

  const withCredit = purchases.filter((p) => p.ivaCategory === 'CREDIT');
  const costExpense = purchases.filter((p) => p.ivaCategory === 'COST_EXPENSE');
  const pending = purchases.filter((p) => p.processingStatus === 'REQUIRES_MANUAL_REVIEW');

  const visible = useMemo(() => {
    if (tab === 'CREDIT') return withCredit;
    if (tab === 'COST_EXPENSE') return costExpense;
    return pending;
  }, [tab, withCredit, costExpense, pending]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function runCascade() {
    startTransition(() => classifyPeriod(taxpayerId, periodId));
  }

  function applyBulk() {
    if (!bulkAction || selected.size === 0) return;
    startTransition(async () => {
      await applyManualClassification(
        Array.from(selected),
        bulkAction as IvaCategory,
        taxpayerId,
        periodId
      );
      setSelected(new Set());
      setBulkAction('');
    });
  }

  return (
    <div className="space-y-6">
      <Button onClick={runCascade} disabled={isPending}>
        {t('classifyButton')}
      </Button>

      <div className="flex gap-2">
        <Button variant={tab === 'CREDIT' ? 'default' : 'outline'} size="sm" onClick={() => setTab('CREDIT')}>
          {t('tabWithCredit')} ({withCredit.length})
        </Button>
        <Button variant={tab === 'COST_EXPENSE' ? 'default' : 'outline'} size="sm" onClick={() => setTab('COST_EXPENSE')}>
          {t('tabCostExpense')} ({costExpense.length})
        </Button>
        <Button variant={tab === 'PENDING' ? 'default' : 'outline'} size="sm" onClick={() => setTab('PENDING')}>
          {t('tabPending')} ({pending.length})
          {pending.length > 0 && <Badge variant="destructive" className="ml-1">•</Badge>}
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">{t('emptyState')}</p>
      ) : (
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b p-3">
            <Checkbox
              checked={selected.size === visible.length && visible.length > 0}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(visible.map((p) => p.id)) : new Set())
              }
            />
            <span className="text-sm">{t('selectAll')}</span>
            <span className="text-sm text-muted-foreground">{t('bulkAction')}:</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('classifyAs')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">{t('withCredit')}</SelectItem>
                <SelectItem value="COST_EXPENSE">{t('costOrExpense')}</SelectItem>
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
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('ruc')}</TableHead>
                <TableHead>{t('total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  </TableCell>
                  <TableCell>{p.supplierName}</TableCell>
                  <TableCell>{p.supplierRuc}</TableCell>
                  <TableCell>{p.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Link href={`/${taxpayerId}/periodos/${periodId}/predeclaracion`}>
        <Button variant="link">{t('continueToPreDeclaration')}</Button>
      </Link>
    </div>
  );
}
