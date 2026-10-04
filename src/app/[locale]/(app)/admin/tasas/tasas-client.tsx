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
import { createTaxRate } from '../actions';

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

  const [rates, setRates] = useState(initialRates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rate, setRate] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [source, setSource] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
