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
 * The latest AI answer per voucher (confidence + the model's own
 * explanation), from the audit log, for the review dialog.
 */
export async function getAiNotes(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  const events = await withUser(userId, (tx) =>
    tx.classificationEvent.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        receivedInvoiceId: { not: null },
        aiReasoning: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })
  );
  const notes = new Map<string, { confidence: string; reasoning: string; modelId: string }>();
  for (const e of events) {
    if (e.receivedInvoiceId && !notes.has(e.receivedInvoiceId)) {
      notes.set(e.receivedInvoiceId, {
        confidence: e.aiConfidence?.toString() ?? '',
        reasoning: e.aiReasoning ?? '',
        modelId: e.modelId ?? '',
      });
    }
  }
  return notes;
}

/**
 * Step 2 of ingestion (ADR-011): groups by supplier and runs the
 * four-level cascade (ADR-005). Resumable -- only touches what's still
 * unclassified.
 */
/** How many AI requests run at once (one per supplier). */
const AI_CONCURRENCY = 5;

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export interface ClassifyOptions {
  /** Re-run exactly these vouchers, whatever their current state. */
  invoiceIds?: string[];
  /** Re-run every voucher not decided by the user (engine results only). */
  reclassify?: boolean;
}

export interface ClassifyResult {
  /** Suppliers whose AI call failed; they are left for manual review. */
  aiFailures: number;
  aiError?: string;
}

export async function classifyPeriod(
  taxpayerId: string,
  periodId: string,
  options: ClassifyOptions = {}
): Promise<ClassifyResult> {
  const userId = await getCurrentUserId();
  const aiClassifier = getAiClassifier(); // null in no-AI mode (ADR-007)
  const result: ClassifyResult = { aiFailures: 0 };

  // Three phases, so no AI call ever runs inside a DB transaction (Prisma's
  // interactive transactions expire after 5 s, and one AI call per
  // supplier easily exceeds that): read, ask the AI, write.

  // Phase 1 -- read.
  const { pending, taxpayer, rules } = await withUser(userId, async (tx) => {
    // Default: only what is still open. REQUIRES_MANUAL_REVIEW is what an
    // earlier engine run left unresolved (a manual decision makes it
    // PROCESSED), so re-running may now resolve it -- e.g. once an AI key
    // is configured. `reclassify` also re-runs engine-classified vouchers
    // but never the user's own decisions; `invoiceIds` is an explicit
    // request and overrides both.
    const statusFilter = options.invoiceIds
      ? { id: { in: options.invoiceIds } }
      : options.reclassify
        ? { OR: [{ classificationSource: null }, { classificationSource: { not: 'USER' as const } }] }
        : { processingStatus: { in: ['UNCLASSIFIED', 'REQUIRES_MANUAL_REVIEW'] as ProcessingStatus[] } };

    const pending = await tx.invoiceReceived.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        vatAmount: { gt: 0 },
        ...statusFilter,
      },
    });
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } });
    const rules = await tx.supplierRule.findMany({
      where: {
        taxpayerId,
        revokedAt: null,
        supplierRuc: { in: [...new Set(pending.map((i) => i.supplierRuc))] },
      },
    });
    return { pending, taxpayer, rules };
  });

  const bySupplier = new Map<string, typeof pending>();
  for (const invoice of pending) {
    const key = invoice.supplierRuc;
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key)!.push(invoice);
  }
  const ruleBySupplier = new Map(rules.map((r) => [r.supplierRuc, r]));

  // ADR-010: a single unrecognized type in the group sends the whole
  // supplier to manual review, without going through the cascade.
  // The allowlist is keyed on SRI type codes; the stored `documentType`
  // is the file's name ("Factura"), so use the code embedded in the
  // access key.
  const needsReviewBySupplier = new Map<string, boolean>();
  const allRecognizedBySupplier = new Map<string, boolean>();
  for (const [supplierRuc, invoices] of bySupplier) {
    const allRecognized = invoices.every((inv) => {
      try {
        return VOUCHER_TYPE_WHITELIST.has(parseAccessKey(inv.accessKey).documentType);
      } catch {
        return false;
      }
    });
    allRecognizedBySupplier.set(supplierRuc, allRecognized);
    needsReviewBySupplier.set(supplierRuc, requiresManualReview(allRecognized));
  }

  // Phase 2 -- ask the AI, outside any transaction. Only worth asking if
  // levels 1-2 wouldn't already decide -- ADR-005's order is rule >
  // catalog > AI, and a rule hit makes an AI call pure unused cost.
  // ADR-007: the request carries only the supplier's own identity, never
  // the taxpayer's RUC or name.
  const aiResults = new Map<string, SupplierClassificationResult>();
  if (aiClassifier) {
    const toAsk = [...bySupplier.entries()].filter(
      ([ruc]) => !needsReviewBySupplier.get(ruc) && !ruleBySupplier.has(ruc)
    );
    await mapWithConcurrency(toAsk, AI_CONCURRENCY, async ([supplierRuc, invoices]) => {
      const representative = invoices[0];
      try {
        const aiResult = await aiClassifier.classifySupplier({
          supplierRuc,
          supplierName: representative.supplierName,
          documentType: representative.documentType,
          // ADR-007: the buyer's activity and regime, never its RUC or name.
          buyerActivities: taxpayer.economicActivities as Array<{ code: string; description: string }>,
          buyerRegime: taxpayer.regime,
        });
        if (aiResult) aiResults.set(supplierRuc, aiResult);
      } catch (err) {
        // A provider/config failure must not abort the whole run: the
        // supplier falls through to manual review and the failure is
        // reported to the screen.
        result.aiFailures += 1;
        result.aiError ??= err instanceof Error ? err.message : String(err);
      }
    });
  }

  // Phase 3 -- decide and write, in one short transaction.
  await withUser(userId, async (tx) => {
    for (const [supplierRuc, invoices] of bySupplier) {
      const allRecognized = allRecognizedBySupplier.get(supplierRuc)!;
      const needsReview = needsReviewBySupplier.get(supplierRuc)!;
      const existingRule = ruleBySupplier.get(supplierRuc);
      const aiResult = aiResults.get(supplierRuc) ?? null;
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

      // A re-run that can't decide must not wipe an existing result --
      // unless the AI did answer and was unsure: then the old result is
      // the weaker evidence and the voucher goes back to review, with the
      // answer recorded. When the AI wasn't consulted or failed (no key,
      // provider error), nothing new is known, so the result stays.
      const targets =
        decision || aiResult ? invoices : invoices.filter((i) => i.processingStatus !== 'PROCESSED');
      if (targets.length === 0) continue;

      await tx.invoiceReceived.updateMany({
        where: { id: { in: targets.map((i) => i.id) } },
        data: {
          ivaCategory: newCategory,
          processingStatus: newStatus,
          classificationSource: source ?? null,
        },
      });
      await tx.classificationEvent.createMany({
        data: targets.map((invoice) => ({
          receivedInvoiceId: invoice.id,
          taxpayerId,
          taxPeriodId: periodId,
          field: 'ivaCategory',
          oldValue: invoice.ivaCategory,
          newValue: newCategory,
          actorType: 'ENGINE' as const,
          reason: decision?.reason ?? 'No match at any level of the cascade',
          // CLAUDE.md -> "AI models": every AI response logs which model
          // and prompt version produced it. Recorded whenever the model
          // was consulted, including answers below the acceptance bar
          // (they explain why the voucher went to manual review).
          modelId: aiResult?.modelId,
          promptVersion: aiResult?.promptVersion,
          aiConfidence: aiResult?.confidence,
          aiReasoning: aiResult?.reasoning,
        })),
      });
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
  return result;
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
