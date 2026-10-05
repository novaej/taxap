'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { classificationCascade, requiresManualReview } from '@/domain/iva';
import type { IvaCategoryEnum } from '@/domain/types';
import { VOUCHER_TYPE_WHITELIST } from '@/services/ingestion';
import { parseAccessKey } from '@/domain/iva/access-key';
import { getAiClassifier } from '@/services/ai';
import type { SupplierClassificationResult } from '@/services/ai';
import type { IvaCategory, ProcessingStatus, ClassificationSourceType } from '@prisma/client';

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
 * Step 2 of ingestion (ADR-011): groups by supplier and runs the
 * four-level cascade (ADR-005). Resumable -- only touches what's still
 * unclassified.
 */
export async function classifyPeriod(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  const aiClassifier = getAiClassifier(); // null in no-AI mode (ADR-007)

  await withUser(userId, async (tx) => {
    const pending = await tx.invoiceReceived.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        // REQUIRES_MANUAL_REVIEW is what an earlier engine run left
        // unresolved (a manual decision makes it PROCESSED), so re-running
        // may now resolve it -- e.g. once an AI key is configured.
        processingStatus: { in: ['UNCLASSIFIED', 'REQUIRES_MANUAL_REVIEW'] },
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
      // ADR-010: a single unrecognized type in the group sends the whole
      // supplier to manual review, without going through the cascade.
      // The allowlist is keyed on SRI type codes; the stored
      // `documentType` is the file's name ("Factura"), so use the code
      // embedded in the access key.
      const allRecognized = invoices.every((inv) => {
        try {
          return VOUCHER_TYPE_WHITELIST.has(parseAccessKey(inv.accessKey).documentType);
        } catch {
          return false;
        }
      });
      const needsReview = requiresManualReview(allRecognized);

      const existingRule = await tx.supplierRule.findFirst({
        where: { taxpayerId, supplierRuc, revokedAt: null },
      });

      const representative = invoices[0];

      // Only worth asking the AI if levels 1-2 wouldn't already decide --
      // ADR-005's order is rule > catalog > AI, and a rule hit makes an AI
      // call pure unused cost. ADR-007: the request carries only the
      // supplier's own identity, never the taxpayer's RUC or name.
      let aiResult: SupplierClassificationResult | null = null;
      if (!needsReview && !existingRule && aiClassifier) {
        aiResult = await aiClassifier.classifySupplier({
          supplierRuc,
          supplierName: representative.supplierName,
          documentType: representative.documentType,
        });
      }

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
            [], // ADR-007: shared catalog, not implemented yet
            aiResult ? { category: aiResult.category as IvaCategoryEnum, confidence: aiResult.confidence } : null
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
            reason: decision?.reason ?? 'No match at any level of the cascade',
            // CLAUDE.md -> "AI models": every AI-sourced response logs
            // which model and prompt version produced it.
            modelId: source === 'AI' ? aiResult?.modelId : undefined,
            promptVersion: source === 'AI' ? aiResult?.promptVersion : undefined,
          },
        });
      }
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
}

/**
 * Manual classification (single or bulk). Creates or updates the
 * supplier's rule so it resolves on its own next time (ADR-006).
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
          reason: 'Manual: user',
        },
      });

      // Revocable rule, unique per (taxpayer, supplier) while not revoked
      // (ADR-006) -- not a composite key the schema can declare, so it's
      // looked up first instead of an upsert by PK.
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
