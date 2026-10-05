import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPeriodIngestion } from './actions';
import { IngestaClient } from './ingesta-client';
import { RemoveFileButton } from './remove-file-button';

const fmtDate = (d: Date) => d.toLocaleDateString('es-EC', { timeZone: 'UTC' });
const fmtDateTime = (d: Date) => d.toLocaleString('es-EC');

export default async function IngestaPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('Ingesta');
  const { files, received, issued, isLocked } = await getPeriodIngestion(taxpayerId, periodId);

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">{t('title')}</h2>

      <IngestaClient />

      <h3 className="mb-3 mt-10 text-lg font-semibold">{t('loadedHeading')}</h3>

      {files.length === 0 ? (
        <p className="text-muted-foreground">{t('loadedEmpty')}</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('filesHeading')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fileName')}</TableHead>
                    <TableHead>{t('fileType')}</TableHead>
                    <TableHead>{t('uploadedAt')}</TableHead>
                    <TableHead className="text-right">{t('totalRows')}</TableHead>
                    <TableHead className="text-right">{t('imported')}</TableHead>
                    <TableHead className="text-right">{t('errors')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.filename}</TableCell>
                      <TableCell>
                        {f.kind === 'PURCHASES_TXT' ? t('kindPurchases') : t('kindSales')}
                      </TableCell>
                      <TableCell>{fmtDateTime(f.uploadedAt)}</TableCell>
                      <TableCell className="text-right">{f.rowCount}</TableCell>
                      <TableCell className="text-right">{f.rowsImported}</TableCell>
                      <TableCell className="text-right">{f.rowsRejected}</TableCell>
                      <TableCell>
                        {!isLocked && (
                          <RemoveFileButton
                            sourceFileId={f.id}
                            taxpayerId={taxpayerId}
                            periodId={periodId}
                            importedCount={f.rowsImported}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {received.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('receivedHeading')}</CardTitle>
                <CardDescription>{t('vouchersCount', { count: received.length })}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('supplier')}</TableHead>
                      <TableHead>{t('series')}</TableHead>
                      <TableHead className="text-right">{t('subtotal')}</TableHead>
                      <TableHead className="text-right">{t('vat')}</TableHead>
                      <TableHead className="text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {received.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{fmtDate(i.issueDate)}</TableCell>
                        <TableCell>
                          {i.supplierName}
                          <div className="text-xs text-muted-foreground">{i.supplierRuc}</div>
                        </TableCell>
                        <TableCell>{i.series}</TableCell>
                        <TableCell className="text-right">{i.subtotal.toString()}</TableCell>
                        <TableCell className="text-right">{i.vatAmount.toString()}</TableCell>
                        <TableCell className="text-right">{i.total.toString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {issued.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('issuedHeading')}</CardTitle>
                <CardDescription>{t('vouchersCount', { count: issued.length })}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('series')}</TableHead>
                      <TableHead className="text-right">{t('subtotal')}</TableHead>
                      <TableHead className="text-right">{t('vat')}</TableHead>
                      <TableHead className="text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issued.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{fmtDate(i.issueDate)}</TableCell>
                        <TableCell>{i.series}</TableCell>
                        <TableCell className="text-right">{i.subtotal.toString()}</TableCell>
                        <TableCell className="text-right">{i.vatAmount.toString()}</TableCell>
                        <TableCell className="text-right">{i.total.toString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
