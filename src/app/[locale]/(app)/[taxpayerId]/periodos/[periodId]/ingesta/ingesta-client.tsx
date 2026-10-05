'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { uploadSourceFiles, type UploadResult } from './actions';

export function IngestaClient() {
  const t = useTranslations('Ingesta');
  const params = useParams<{ taxpayerId: string; periodId: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const res = await uploadSourceFiles(params.taxpayerId, params.periodId, formData);
      if (!res.success) {
        setError(res.error ?? 'Error desconocido');
        return;
      }
      setResult(res);
    });
  }

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('uploadHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".txt"
            disabled={isPending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              {t('selectedFile')}: {file.name} · {t('fileSize')}: {(file.size / 1024).toFixed(2)} KB
            </p>
          )}
          <Button onClick={handleUpload} disabled={!file || isPending}>
            {isPending ? t('uploading') : t('uploadButton')}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result?.success && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('resultHeading')}</CardTitle>
              <CardDescription>
                {t('fileType')}: {result.fileType}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{result.totalRows}</div>
                <div className="text-sm text-muted-foreground">{t('totalRows')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{result.validCount}</div>
                <div className="text-sm text-muted-foreground">{t('valid')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{result.duplicateCount}</div>
                <div className="text-sm text-muted-foreground">{t('alreadyLoaded')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{result.errorCount}</div>
                <div className="text-sm text-muted-foreground">{t('errors')}</div>
              </div>
            </CardContent>
          </Card>

          {(result.errorCount ?? 0) > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{t('errorsHeading')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('row')}</TableHead>
                      <TableHead>{t('field')}</TableHead>
                      <TableHead>{t('errorColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results
                      ?.map((r, i) => ({ ...r, index: i }))
                      .filter((r) => !r.isValid && r.errors.some((e) => e.code !== 'DUPLICATE'))
                      .flatMap((r) =>
                        r.errors
                          .filter((err) => err.code !== 'DUPLICATE')
                          .map((err, j) => (
                          <TableRow key={`${r.index}-${j}`}>
                            <TableCell>{r.index + 2}</TableCell>
                            <TableCell>{err.field}</TableCell>
                            <TableCell>{err.message}</TableCell>
                          </TableRow>
                        ))
                      )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {(result.validCount ?? 0) > 0 && (
            <Alert className="border-green-600">
              <CheckCircle2 className="size-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <span>{t('readyMessage', { count: result.validCount ?? 0 })}</span>
                <Link href={`/${params.taxpayerId}/periodos/${params.periodId}/ventas`}>
                  <Button variant="link">{t('continueToClassification')}</Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
