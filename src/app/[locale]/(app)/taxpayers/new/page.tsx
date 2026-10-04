'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTaxpayer } from '../actions';

interface ActivityRow {
  code: string;
  description: string;
}

export default function NewTaxpayerPage() {
  const t = useTranslations('Taxpayers');
  const router = useRouter();

  const [ruc, setRuc] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [regime, setRegime] = useState('GENERAL');
  const [ivaPeriodicity, setIvaPeriodicity] = useState('MONTHLY');
  const [activities, setActivities] = useState<ActivityRow[]>([{ code: '', description: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateActivity(index: number, field: keyof ActivityRow, value: string) {
    setActivities((prev) =>
      prev.map((activity, i) => (i === index ? { ...activity, [field]: value } : activity))
    );
  }

  function addActivity() {
    setActivities((prev) => [...prev, { code: '', description: '' }]);
  }

  function removeActivity(index: number) {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (ruc.length !== 13) {
      setError(t('rucInvalid'));
      setIsSubmitting(false);
      return;
    }

    const economicActivities = activities
      .filter((a) => a.code.trim() !== '')
      .map((a) => ({ code: a.code.trim(), description: a.description.trim() }));

    const result = await createTaxpayer({
      ruc,
      businessName,
      tradeName: tradeName || undefined,
      regime: regime as 'GENERAL' | 'RIMPE_POPULAR' | 'RIMPE_EMPRENDEDOR',
      ivaPeriodicity: ivaPeriodicity as 'MONTHLY' | 'SEMIANNUAL' | 'ANNUAL',
      economicActivities,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error === 'RUC_IN_USE' ? t('rucInUse') : t('rucInvalid'));
      return;
    }

    router.push('/taxpayers');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/taxpayers" className="text-sm text-muted-foreground hover:underline">
          ← {t('title')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('newTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruc">{t('ruc')}</Label>
              <Input
                id="ruc"
                value={ruc}
                onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                maxLength={13}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">{t('businessName')}</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeName">
                {t('tradeName')} <span className="text-muted-foreground">{t('tradeNameOptional')}</span>
              </Label>
              <Input id="tradeName" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t('regime')}</Label>
              <Select value={regime} onValueChange={setRegime}>
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
              <Select value={ivaPeriodicity} onValueChange={setIvaPeriodicity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">{t('periodicityOptions.MONTHLY')}</SelectItem>
                  <SelectItem value="SEMIANNUAL">{t('periodicityOptions.SEMIANNUAL')}</SelectItem>
                  <SelectItem value="ANNUAL">{t('periodicityOptions.ANNUAL')}</SelectItem>
                </SelectContent>
              </Select>
              {ivaPeriodicity !== 'MONTHLY' && (
                <p className="text-sm text-muted-foreground">{t('periodicityNotice')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('activitiesHeading')}</Label>
              <div className="space-y-2">
                {activities.map((activity, index) => (
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
                    {activities.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeActivity(index)}
                      >
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
              {t('createButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
