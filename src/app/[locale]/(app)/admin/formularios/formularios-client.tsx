'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createFormVersionDraft } from '../actions';

interface VersionRow {
  id: string;
  formCode: string;
  label: string;
  validFrom: string;
  status: string;
}

export function FormulariosClient({ initialVersions }: { initialVersions: VersionRow[] }) {
  const t = useTranslations('Admin');

  const [versions, setVersions] = useState(initialVersions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCode, setFormCode] = useState('104');
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    if (!file) return;
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const result = await createFormVersionDraft({ formCode, label, validFrom, formData });
    setIsSubmitting(false);

    if (!result.success || !result.formVersionId) {
      setError(result.error === 'ALREADY_EXISTS' ? t('alreadyExistsError') : t('unknownError'));
      return;
    }

    setVersions((prev) => [
      { id: result.formVersionId!, formCode, label, validFrom, status: 'DRAFT' },
      ...prev,
    ]);
    setDialogOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t('newVersionButton')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newVersionTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('formCode')}</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('label')}</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('validFrom')}</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('uploadPdfLabel')}</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
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
                disabled={isSubmitting || !file || !label || !validFrom}
              >
                {t('createDraftButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {versions.length === 0 ? (
        <p className="text-muted-foreground">{t('formulariosEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <Link key={v.id} href={`/admin/formularios/${v.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {v.formCode} — {v.label}
                  </CardTitle>
                  <Badge variant={v.status === 'PUBLISHED' ? 'default' : 'outline'}>
                    {v.status === 'PUBLISHED' ? t('statusPublished') : t('statusDraft')}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
