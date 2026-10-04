'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTaxpayer } from './actions';
import { updateTaxpayer } from '../[taxpayerId]/actions';

interface ActivityRow {
  code: string;
  description: string;
}

export interface TaxpayerFormValues {
  ruc: string;
  businessName: string;
  tradeName: string;
  regime: string;
  ivaPeriodicity: string;
  economicActivities: ActivityRow[];
}

const emptyValues: TaxpayerFormValues = {
  ruc: '',
  businessName: '',
  tradeName: '',
  regime: 'GENERAL',
  ivaPeriodicity: 'MONTHLY',
  economicActivities: [{ code: '', description: '' }],
};

export function TaxpayerForm({
  mode,
  taxpayerId,
  initial,
}: {
  mode: 'create' | 'edit';
  taxpayerId?: string;
  initial?: TaxpayerFormValues;
}) {
  const t = useTranslations('Taxpayers');
  const router = useRouter();

  const [values, setValues] = useState<TaxpayerFormValues>(initial ?? emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateActivity(index: number, field: keyof ActivityRow, value: string) {
    setValues((prev) => ({
      ...prev,
      economicActivities: prev.economicActivities.map((activity, i) =>
        i === index ? { ...activity, [field]: value } : activity
      ),
    }));
  }

  function addActivity() {
    setValues((prev) => ({
      ...prev,
      economicActivities: [...prev.economicActivities, { code: '', description: '' }],
    }));
  }

  function removeActivity(index: number) {
    setValues((prev) => ({
      ...prev,
      economicActivities: prev.economicActivities.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (values.ruc.length !== 13) {
      setError(t('rucInvalid'));
      setIsSubmitting(false);
      return;
    }

    const economicActivities = values.economicActivities
      .filter((a) => a.code.trim() !== '')
      .map((a) => ({ code: a.code.trim(), description: a.description.trim() }));

    const input = {
      ruc: values.ruc,
      businessName: values.businessName,
      tradeName: values.tradeName || undefined,
      regime: values.regime as 'GENERAL' | 'RIMPE_POPULAR' | 'RIMPE_EMPRENDEDOR',
      ivaPeriodicity: values.ivaPeriodicity as 'MONTHLY' | 'SEMIANNUAL' | 'ANNUAL',
      economicActivities,
    };

    const result =
      mode === 'create'
        ? await createTaxpayer(input)
        : await updateTaxpayer(taxpayerId!, input);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error === 'RUC_IN_USE' ? t('rucInUse') : t('rucInvalid'));
      return;
    }

    if (mode === 'create') {
      router.push('/taxpayers');
    } else {
      router.push(`/${taxpayerId}/periodos`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ruc">{t('ruc')}</Label>
        <Input
          id="ruc"
          value={values.ruc}
          onChange={(e) => setValues((v) => ({ ...v, ruc: e.target.value.replace(/\D/g, '') }))}
          maxLength={13}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessName">{t('businessName')}</Label>
        <Input
          id="businessName"
          value={values.businessName}
          onChange={(e) => setValues((v) => ({ ...v, businessName: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tradeName">
          {t('tradeName')} <span className="text-muted-foreground">{t('tradeNameOptional')}</span>
        </Label>
        <Input
          id="tradeName"
          value={values.tradeName}
          onChange={(e) => setValues((v) => ({ ...v, tradeName: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('regime')}</Label>
        <Select
          value={values.regime}
          onValueChange={(regime) => setValues((v) => ({ ...v, regime }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">{t('regimeOptions.GENERAL')}</SelectItem>
            <SelectItem value="RIMPE_POPULAR">{t('regimeOptions.RIMPE_POPULAR')}</SelectItem>
            <SelectItem value="RIMPE_EMPRENDEDOR">{t('regimeOptions.RIMPE_EMPRENDEDOR')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('periodicity')}</Label>
        <Select
          value={values.ivaPeriodicity}
          onValueChange={(ivaPeriodicity) => setValues((v) => ({ ...v, ivaPeriodicity }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">{t('periodicityOptions.MONTHLY')}</SelectItem>
            <SelectItem value="SEMIANNUAL">{t('periodicityOptions.SEMIANNUAL')}</SelectItem>
            <SelectItem value="ANNUAL">{t('periodicityOptions.ANNUAL')}</SelectItem>
          </SelectContent>
        </Select>
        {values.ivaPeriodicity !== 'MONTHLY' && (
          <p className="text-sm text-muted-foreground">{t('periodicityNotice')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('activitiesHeading')}</Label>
        <div className="space-y-2">
          {values.economicActivities.map((activity, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t('activityCode')}
                value={activity.code}
                onChange={(e) => updateActivity(index, 'code', e.target.value)}
                className="w-32"
              />
              <Input
                placeholder={t('activityDescription')}
                value={activity.description}
                onChange={(e) => updateActivity(index, 'description', e.target.value)}
              />
              {values.economicActivities.length > 1 && (
                <Button type="button" variant="outline" onClick={() => removeActivity(index)}>
                  {t('removeActivity')}
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addActivity}>
          {t('addActivity')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {mode === 'create' ? t('createButton') : t('saveButton')}
      </Button>
    </form>
  );
}
