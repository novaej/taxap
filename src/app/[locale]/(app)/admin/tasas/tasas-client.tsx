'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { createTaxRate, deleteTaxRate } from '../actions';

interface RateRow {
  tax: string;
  rate: string;
  validFrom: string;
  validTo: string | null;
  source: string;
  verifiedAt: string;
}

export function TasasClient({ initialRates }: { initialRates: RateRow[] }) {
  const t = useTranslations('Admin');
  const common = useTranslations('Common');

  const [rates, setRates] = useState(initialRates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rate, setRate] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [source, setSource] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);

    const result = await createTaxRate({
      tax: 'IVA',
      rate: (parseFloat(rate) / 100).toString(),
      validFrom,
      validTo: validTo || undefined,
      source,
      verifiedAt,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error === 'ALREADY_EXISTS' ? t('alreadyExistsError') : t('unknownError'));
      return;
    }

    setRates((prev) => [
      { tax: 'IVA', rate: (parseFloat(rate) / 100).toString(), validFrom, validTo: validTo || null, source, verifiedAt },
      ...prev,
    ]);
    setDialogOpen(false);
  }

  async function handleDelete(r: RateRow) {
    if (!window.confirm(t('deleteRateConfirm'))) return;
    setListError(null);
    const result = await deleteTaxRate(r.tax as 'IVA', r.validFrom);
    if (!result.success) {
      setListError(t('unknownError'));
      return;
    }
    setRates((prev) => prev.filter((x) => !(x.tax === r.tax && x.validFrom === r.validFrom)));
  }

  return (
    <div>
      {listError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}
      <div className="mb-4 flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t('newRateButton')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newRateTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>{t('verificationNotice')}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>{t('rate')}</Label>
                <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('validFrom')}</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  {t('validTo')} <span className="text-muted-foreground">{t('validToOptional')}</span>
                </Label>
                <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('source')}</Label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder={t('sourcePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('verifiedAt')}</Label>
                <Input type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !rate || !validFrom || !source || !verifiedAt}
              >
                {t('createRateButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rates.length === 0 ? (
        <p className="text-muted-foreground">{t('tasasEmpty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rate')}</TableHead>
              <TableHead>{t('validFrom')}</TableHead>
              <TableHead>{t('validTo')}</TableHead>
              <TableHead>{t('source')}</TableHead>
              <TableHead>{t('verifiedAt')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.validFrom}>
                <TableCell>{(parseFloat(r.rate) * 100).toFixed(2)}%</TableCell>
                <TableCell>{new Date(r.validFrom).toLocaleDateString('es-EC', { timeZone: 'UTC' })}</TableCell>
                <TableCell>
                  {r.validTo
                    ? new Date(r.validTo).toLocaleDateString('es-EC', { timeZone: 'UTC' })
                    : '—'}
                </TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell>{new Date(r.verifiedAt).toLocaleDateString('es-EC', { timeZone: 'UTC' })}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={common('delete')}
                    aria-label={common('delete')}
                    onClick={() => handleDelete(r)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
