'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { calculatePeriodResults } from '@/domain/iva';
import type { ClassifiedInvoice } from '@/domain/iva';
import { IvaCategoryEnum, SalesTreatmentEnum } from '@/domain/types';

/**
 * Runs the domain calculation over the period's vouchers and saves the
 * results (ADR-015: the domain layer never knows about form fields).
 */
export async function computePeriodResults(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();

  const results = await withUser(userId, async (tx) => {
    const [received, issued] = await Promise.all([
      tx.invoiceReceived.findMany({ where: { taxpayerId, taxPeriodId: periodId } }),
      tx.invoiceIssued.findMany({ where: { taxpayerId, taxPeriodId: periodId } }),
    ]);

    const invoices: ClassifiedInvoice[] = [
      ...received.map((r) => ({
        id: r.id,
        type: 'RECEIVED' as const,
        subtotal: r.subtotal,
        vat: r.vatAmount,
        ivaCategory: r.ivaCategory as IvaCategoryEnum,
      })),
      ...issued.map((i) => ({
        id: i.id,
        type: 'ISSUED' as const,
        subtotal: i.subtotal,
        vat: i.vatAmount,
        salesTreatment: i.salesTreatment as SalesTreatmentEnum,
      })),
    ];

    const computed = calculatePeriodResults({ periodId, invoices });

    for (const [key, result] of computed) {
      await tx.periodResult.upsert({
        where: { taxPeriodId_resultKey: { taxPeriodId: periodId, resultKey: key } },
        update: { value: result.value },
        create: { taxPeriodId: periodId, resultKey: key, value: result.value },
      });
    }

    return computed;
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}`, 'layout');
  return Array.from(results.entries()).map(([key, r]) => ({
    key,
    value: r.value.toString(),
  }));
}

export async function getPeriodResults(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.periodResult.findMany({ where: { taxPeriodId: periodId } })
  );
}

/**
 * Period close-out (ADR-013): sets locked_at. A Postgres trigger rejects
 * any further modification of this period's vouchers (migration
 * `*_add_period_lock`) -- it doesn't depend on the application remembering
 * to check.
 */
export async function lockPeriod(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const period = await tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } });
    await tx.taxPeriod.update({
      where: { id: periodId },
      data: { status: 'FILED', filedAt: new Date(), lockedAt: new Date() },
    });
    await tx.classificationEvent.create({
      data: {
        taxpayerId,
        taxPeriodId: periodId,
        field: 'status',
        oldValue: period.status,
        newValue: 'FILED',
        actorType: 'USER',
        actorUserId: userId,
        reason: 'Period marked as filed',
      },
    });
  });
  revalidatePath(`/${taxpayerId}/periodos/${periodId}`, 'layout');
}

/**
 * Explicit reopening (ADR-013): the reopening itself gets logged, not
 * just whatever gets edited afterward.
 */
export async function reopenPeriod(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const period = await tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } });
    await tx.taxPeriod.update({
      where: { id: periodId },
      data: { status: 'DRAFT', lockedAt: null },
    });
    await tx.classificationEvent.create({
      data: {
        taxpayerId,
        taxPeriodId: periodId,
        field: 'status',
        oldValue: period.status,
        newValue: 'DRAFT',
        actorType: 'USER',
        actorUserId: userId,
        reason: 'Period reopened',
      },
    });
  });
  revalidatePath(`/${taxpayerId}/periodos/${periodId}`, 'layout');
}
