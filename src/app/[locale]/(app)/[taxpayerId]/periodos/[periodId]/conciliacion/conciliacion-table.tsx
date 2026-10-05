'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles } from 'lucide-react';
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
  hasVat: boolean;
  issueDate: string;
  series: string;
}

type Tab = 'UNCLASSIFIED' | 'CREDIT' | 'COST_EXPENSE' | 'PENDING' | 'NO_VAT';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isPending, startTransition] = useTransition();

  // Vouchers without IVA never enter classification (CLAUDE.md), so they
  // are left out of every tab and only counted in a note.
  const noVat = purchases.filter((p) => !p.hasVat);
  const unclassified = purchases.filter(
    (p) => p.hasVat && p.processingStatus === 'UNCLASSIFIED'
  );
  const withCredit = purchases.filter((p) => p.ivaCategory === 'CREDIT');
  const costExpense = purchases.filter((p) => p.ivaCategory === 'COST_EXPENSE');
  const pending = purchases.filter((p) => p.processingStatus === 'REQUIRES_MANUAL_REVIEW');

  // Open on the first tab that has something, not on an empty one: an
  // empty "Pendientes" read as "everything is classified".
  const [tab, setTab] = useState<Tab>(() =>
    unclassified.length > 0
      ? 'UNCLASSIFIED'
      : pending.length > 0
        ? 'PENDING'
        : withCredit.length > 0
          ? 'CREDIT'
          : costExpense.length > 0
            ? 'COST_EXPENSE'
            : 'UNCLASSIFIED'
  );

  const visible = useMemo(() => {
    if (tab === 'NO_VAT') return noVat;
    if (tab === 'UNCLASSIFIED') return unclassified;
    if (tab === 'CREDIT') return withCredit;
    if (tab === 'COST_EXPENSE') return costExpense;
    return pending;
  }, [tab, noVat, unclassified, withCredit, costExpense, pending]);

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

  function reclassifySelected() {
    if (selected.size === 0) return;
    startTransition(async () => {
      await classifyPeriod(taxpayerId, periodId, { invoiceIds: Array.from(selected) });
      setSelected(new Set());
    });
  }

  function reclassifyAll() {
    if (!window.confirm(t('reclassifyAllConfirm'))) return;
    startTransition(() => classifyPeriod(taxpayerId, periodId, { reclassify: true }));
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
      {unclassified.length > 0 && (
        <Alert className="border-primary">
          <Sparkles className="size-4 text-primary" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('unclassifiedHint', { count: unclassified.length })}</span>
            <Button onClick={runCascade} disabled={isPending}>
              {isPending ? t('classifying') : t('classifyButton')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {withCredit.length + costExpense.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={reclassifyAll} disabled={isPending}>
            <RefreshCw className="size-4" />
            {t('reclassifyAll')}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'UNCLASSIFIED' ? 'default' : 'outline'} size="sm" onClick={() => setTab('UNCLASSIFIED')}>
          {t('tabUnclassified')} ({unclassified.length})
        </Button>
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
        <Button variant={tab === 'NO_VAT' ? 'default' : 'outline'} size="sm" onClick={() => setTab('NO_VAT')}>
          {t('tabNoVat')} ({noVat.length})
        </Button>
      </div>

      {tab === 'NO_VAT' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('noVatInfo')}</p>
          {noVat.length === 0 ? (
            <p className="text-muted-foreground">{t('emptyState')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('supplier')}</TableHead>
                    <TableHead>{t('ruc')}</TableHead>
                    <TableHead>{t('series')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noVat.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.issueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell>{p.supplierRuc}</TableCell>
                      <TableCell>{p.series}</TableCell>
                      <TableCell className="text-right">{p.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <>
      {tab === 'PENDING' && pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t('pendingHint')}</span>
          <Button variant="outline" size="sm" onClick={runCascade} disabled={isPending}>
            {isPending ? t('classifying') : t('retryClassify')}
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          {tab === 'UNCLASSIFIED' && purchases.length > 0 && pending.length + withCredit.length + costExpense.length === 0
            ? t('nothingClassifiedYet')
            : t('emptyState')}
        </p>
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
            <Button
              size="sm"
              variant="outline"
              onClick={reclassifySelected}
              disabled={isPending || selected.size === 0}
            >
              <RefreshCw className="size-4" />
              {t('reclassifySelected')}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('ruc')}</TableHead>
                <TableHead>{t('total')}</TableHead>
                <TableHead>{t('classification')}</TableHead>
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
                  <TableCell>
                    <Badge variant={p.ivaCategory === 'UNCLASSIFIED' ? 'outline' : 'default'}>
                      {p.ivaCategory === 'CREDIT'
                        ? t('withCredit')
                        : p.ivaCategory === 'COST_EXPENSE'
                          ? t('costOrExpense')
                          : p.processingStatus === 'REQUIRES_MANUAL_REVIEW'
                            ? t('tabPending')
                            : t('tabUnclassified')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

        </>
      )}

      <Link href={`/${taxpayerId}/periodos/${periodId}/predeclaracion`}>
        <Button variant="link">{t('continueToPreDeclaration')}</Button>
      </Link>
    </div>
  );
}
