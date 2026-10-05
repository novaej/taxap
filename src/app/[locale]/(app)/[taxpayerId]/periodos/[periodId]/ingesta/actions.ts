'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { parseFile, ingestionService } from '@/services/ingestion';
import type { ReceivedInvoiceRow, IssuedInvoiceRow } from '@/services/ingestion';
import { saveSourceFile, deleteSourceFile } from '@/services/storage';
import crypto from 'crypto';

export interface UploadResult {
  success: boolean;
  error?: string;
  sourceFileId?: string;
  fileType?: 'RECIBIDAS' | 'EMITIDAS';
  totalRows?: number;
  validCount?: number;
  errorCount?: number;
  duplicateCount?: number;
  results?: Array<{ isValid: boolean; errors: Array<{ field: string; message: string; code: string }> }>;
}

/**
 * Step 1 of ingestion (ADR-011): parses, validates, and saves vouchers as
 * unclassified. Synchronous, resumable -- if something fails afterward,
 * nothing is lost.
 */
export async function uploadSourceFiles(
  taxpayerId: string,
  periodId: string,
  formData: FormData
): Promise<UploadResult> {
  const userId = await getCurrentUserId();
  const file = formData.get('file') as File | null;
  if (!file) {
    return { success: false, error: 'No se seleccionó ningún archivo' };
  }

  const content = await file.text();
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const parseResult = parseFile(content);

  if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
    return {
      success: false,
      error: 'No se pudo interpretar el formato del archivo',
    };
  }

  return withUser(userId, async (tx) => {
    const taxPeriod = await tx.taxPeriod.findFirstOrThrow({
      where: { id: periodId, taxpayerId },
    });
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({
      where: { id: taxpayerId },
    });

    const existing = await tx.invoiceReceived.findMany({
      where: { taxpayerId },
      select: { accessKey: true },
    });
    const existingAccessKeys = new Set(existing.map((i) => i.accessKey));

    const validationResults = parseResult.rows.map(
      (row: ReceivedInvoiceRow | IssuedInvoiceRow) =>
        parseResult.fileType === 'RECIBIDAS'
          ? ingestionService.validateReceivedRow(
              row as ReceivedInvoiceRow,
              taxpayer.ruc,
              taxPeriod.periodStart,
              taxPeriod.periodEnd,
              existingAccessKeys
            )
          : ingestionService.validateIssuedRow(
              row as IssuedInvoiceRow,
              taxpayer.ruc,
              taxPeriod.periodStart,
              taxPeriod.periodEnd,
              existingAccessKeys
            )
    );

    // A row whose only problem is DUPLICATE was imported by an earlier
    // upload: it's skipped, not a validation error.
    const isDuplicateOnly = (r: (typeof validationResults)[number]) =>
      !r.isValid && r.errors.every((e) => e.code === 'DUPLICATE');
    const importedCount = validationResults.filter((r) => r.isValid).length;
    const duplicateCount = validationResults.filter(isDuplicateOnly).length;
    const errorCount = validationResults.length - importedCount - duplicateCount;

    // Nothing new to record (e.g. the same file uploaded twice): no
    // source_files row and no stored copy -- they'd only add noise.
    if (importedCount === 0) {
      return {
        success: true,
        fileType: parseResult.fileType,
        totalRows: parseResult.rows.length,
        validCount: 0,
        errorCount,
        duplicateCount,
        results: validationResults,
      };
    }

    // Inside the transaction so a failed write leaves no row pointing at a
    // missing file; keyed by sha256, so a retry overwrites instead of
    // leaving an orphan.
    await saveSourceFile(taxpayerId, sha256, content);

    const sourceFile = await tx.sourceFile.create({
      data: {
        taxpayerId,
        taxPeriodId: periodId,
        kind: parseResult.fileType === 'RECIBIDAS' ? 'PURCHASES_TXT' : 'SALES_TXT',
        filename: file.name,
        sha256,
        rowCount: parseResult.rows.length,
        rowsImported: importedCount,
        rowsRejected: errorCount,
        uploadedBy: userId,
      },
    });

    for (let i = 0; i < parseResult.rows.length; i++) {
      if (!validationResults[i].isValid) continue;
      const row = parseResult.rows[i];

      if (parseResult.fileType === 'RECIBIDAS') {
        const r = row as ReceivedInvoiceRow;
        await tx.invoiceReceived.upsert({
          where: { taxpayerId_accessKey: { taxpayerId, accessKey: r.CLAVE_ACCESO } },
          create: {
            taxpayerId,
            taxPeriodId: periodId,
            sourceFileId: sourceFile.id,
            accessKey: r.CLAVE_ACCESO,
            supplierRuc: r.RUC_EMISOR,
            supplierName: r.RAZON_SOCIAL_EMISOR,
            documentType: r.TIPO_COMPROBANTE,
            series: r.SERIE_COMPROBANTE,
            issueDate: parseSriDate(r.FECHA_EMISION),
            subtotal: r.VALOR_SIN_IMPUESTOS,
            vatAmount: r.IVA,
            total: r.IMPORTE_TOTAL,
          },
          update: {},
        });
      } else {
        const r = row as IssuedInvoiceRow;
        await tx.invoiceIssued.upsert({
          where: { taxpayerId_accessKey: { taxpayerId, accessKey: r.CLAVE_ACCESO } },
          create: {
            taxpayerId,
            taxPeriodId: periodId,
            sourceFileId: sourceFile.id,
            accessKey: r.CLAVE_ACCESO,
            documentType: r.COMPROBANTE,
            series: r.SERIE_COMPROBANTE,
            issueDate: parseSriDate(r.FECHA_EMISION),
            subtotal: r.VALOR_SIN_IMPUESTOS,
            vatAmount: r.IVA,
            total: r.IMPORTE_TOTAL,
          },
          update: {},
        });
      }
    }

    revalidatePath(`/${taxpayerId}/periodos/${periodId}/ingesta`);

    return {
      success: true,
      sourceFileId: sourceFile.id,
      fileType: parseResult.fileType,
      totalRows: parseResult.rows.length,
      validCount: importedCount,
      errorCount,
      duplicateCount,
      results: validationResults,
    };
  });
}

/** What this period already has loaded: the upload history and the vouchers. */
export async function getPeriodIngestion(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const [files, received, issued] = await Promise.all([
      tx.sourceFile.findMany({
        where: { taxpayerId, taxPeriodId: periodId },
        orderBy: { uploadedAt: 'desc' },
      }),
      tx.invoiceReceived.findMany({
        where: { taxpayerId, taxPeriodId: periodId },
        orderBy: { issueDate: 'asc' },
      }),
      tx.invoiceIssued.findMany({
        where: { taxpayerId, taxPeriodId: periodId },
        orderBy: { issueDate: 'asc' },
      }),
    ]);
    return { files, received, issued };
  });
}

export async function removeSourceFile(sourceFileId: string, taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  const deleted = await withUser(userId, (tx) =>
    tx.sourceFile.delete({ where: { id: sourceFileId } })
  );
  await deleteSourceFile(taxpayerId, deleted.sha256);
  revalidatePath(`/${taxpayerId}/periodos/${periodId}/ingesta`);
}

function parseSriDate(value: string): Date {
  const [day, month, year] = value.split(' ')[0].split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
