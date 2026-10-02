'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { calculatePeriodResults } from '@/domain/iva';
import type { ClassifiedInvoice } from '@/domain/iva';
import { IvaCategoryEnum, SalesTreatmentEnum } from '@/domain/types';

/**
 * Ejecuta el cálculo del dominio sobre los comprobantes del período y
 * guarda los resultados (ADR-015: el dominio no conoce casilleros).
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

  revalidatePath(`/${taxpayerId}/periodos/${periodId}`);
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
 * Cierre de período (ADR-013): fija locked_at. Un disparador en Postgres
 * rechaza toda modificación posterior de los comprobantes de este período
 * (migración `*_add_period_lock`) -- no depende de que la aplicación se
 * acuerde de revisarlo.
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
        reason: 'Período marcado como declarado',
      },
    });
  });
  revalidatePath(`/${taxpayerId}/periodos/${periodId}`);
}

/**
 * Reapertura explícita (ADR-013): la reapertura en sí queda registrada,
 * no solo lo que se edite después.
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
        reason: 'Período reabierto',
      },
    });
  });
  revalidatePath(`/${taxpayerId}/periodos/${periodId}`);
}
