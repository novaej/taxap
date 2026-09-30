'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { classificationCascade, requiresManualReview } from '@/domain/iva';
import type { IvaCategoryEnum } from '@/domain/types';
import { VOUCHER_TYPE_WHITELIST } from '@/services/ingestion';
import type { IvaCategory, ProcessingStatus, ClassificationSourceType } from '@prisma/client';

async function getCurrentUserId(): Promise<string> {
  throw new Error('Auth not wired up yet');
}

export async function getPurchasesByStatus(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.invoiceReceived.findMany({
      where: { taxpayerId, taxPeriodId: periodId },
      orderBy: { issueDate: 'asc' },
    })
  );
}

/**
 * Paso 2 de la ingesta (ADR-011): agrupa por proveedor y corre la cascada
 * de cuatro niveles (ADR-005). Reanudable — solo toca lo que sigue sin
 * clasificar.
 */
export async function classifyPeriod(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();

  await withUser(userId, async (tx) => {
    const pending = await tx.invoiceReceived.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        processingStatus: 'UNCLASSIFIED',
        vatAmount: { gt: 0 },
      },
    });

    const bySupplier = new Map<string, typeof pending>();
    for (const invoice of pending) {
      const key = invoice.supplierRuc;
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key)!.push(invoice);
    }

    const taxpayer = await tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } });

    for (const [supplierRuc, invoices] of bySupplier) {
      // ADR-010: un solo tipo no reconocido en el grupo manda todo el
      // proveedor a revisión manual, sin pasar por la cascada.
      const allRecognized = invoices.every((inv) =>
        VOUCHER_TYPE_WHITELIST.has(inv.documentType)
      );
      const needsReview = requiresManualReview(allRecognized);

      const existingRule = await tx.supplierRule.findFirst({
        where: { taxpayerId, supplierRuc, revokedAt: null },
      });

      const representative = invoices[0];
      const decision = needsReview
        ? null
        : classificationCascade.classify(
            {
              invoiceId: representative.id,
              emitterRuc: supplierRuc,
              emitterName: representative.supplierName,
              documentType: representative.documentType,
              series: representative.series,
              subtotal: representative.subtotal,
              vat: representative.vatAmount,
              documentTypeRecognized: allRecognized,
              activityFingerprint: taxpayer.activityFingerprint,
            },
            existingRule
              ? {
                  taxpayerId,
                  emitterRuc: supplierRuc,
                  activityFingerprint: existingRule.activityFingerprint,
                  category: existingRule.ivaCategory as unknown as IvaCategoryEnum,
                }
              : null,
            [], // ADR-007: catálogo compartido, no implementado aún
            null // ADR-007: nivel 3 (IA), no implementado aún
          );

      const newStatus: ProcessingStatus = decision ? 'PROCESSED' : 'REQUIRES_MANUAL_REVIEW';
      const newCategory: IvaCategory = decision?.category ?? 'UNCLASSIFIED';
      const source: ClassificationSourceType | undefined = decision
        ? decision.method === 'RULE'
          ? 'RULE'
          : decision.method === 'CATALOG'
            ? 'CATALOG'
            : decision.method === 'AI'
              ? 'AI'
              : 'DETERMINISTIC'
        : undefined;

      for (const invoice of invoices) {
        await tx.invoiceReceived.update({
          where: { id: invoice.id },
          data: {
            ivaCategory: newCategory,
            processingStatus: newStatus,
            classificationSource: source,
          },
        });
        await tx.classificationEvent.create({
          data: {
            receivedInvoiceId: invoice.id,
            taxpayerId,
            taxPeriodId: periodId,
            field: 'ivaCategory',
            oldValue: invoice.ivaCategory,
            newValue: newCategory,
            actorType: 'ENGINE',
            reason: decision?.reason ?? 'Sin coincidencia en ningún nivel de la cascada',
          },
        });
      }
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
}

/**
 * Clasificación manual (individual o masiva). Crea o actualiza la regla del
 * proveedor para que se resuelva sola la próxima vez (ADR-006).
 */
export async function applyManualClassification(
  invoiceIds: string[],
  category: IvaCategory,
  taxpayerId: string,
  periodId: string
) {
  const userId = await getCurrentUserId();

  await withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } });

    for (const id of invoiceIds) {
      const invoice = await tx.invoiceReceived.findUniqueOrThrow({ where: { id } });

      await tx.invoiceReceived.update({
        where: { id },
        data: {
          ivaCategory: category,
          processingStatus: 'PROCESSED',
          classificationSource: 'USER',
        },
      });

      await tx.classificationEvent.create({
        data: {
          receivedInvoiceId: id,
          taxpayerId,
          taxPeriodId: periodId,
          field: 'ivaCategory',
          oldValue: invoice.ivaCategory,
          newValue: category,
          actorType: 'USER',
          actorUserId: userId,
          reason: 'Manual: usuario',
        },
      });

      // Regla revocable, única por (contribuyente, proveedor) mientras no
      // esté revocada (ADR-006) — no es una clave compuesta declarable en
      // el esquema, así que se busca primero en vez de un upsert por PK.
      const existingRule = await tx.supplierRule.findFirst({
        where: { taxpayerId, supplierRuc: invoice.supplierRuc, revokedAt: null },
      });

      if (existingRule) {
        await tx.supplierRule.update({
          where: { id: existingRule.id },
          data: {
            ivaCategory: category,
            activityFingerprint: taxpayer.activityFingerprint,
            timesApplied: { increment: 1 },
          },
        });
      } else {
        await tx.supplierRule.create({
          data: {
            taxpayerId,
            supplierRuc: invoice.supplierRuc,
            activityFingerprint: taxpayer.activityFingerprint,
            ivaCategory: category,
            source: 'USER',
            createdBy: userId,
          },
        });
      }
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
}
