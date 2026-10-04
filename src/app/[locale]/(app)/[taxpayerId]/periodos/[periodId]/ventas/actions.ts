'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import type { SalesTreatment } from '@prisma/client';

export async function getPendingSales(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.invoiceIssued.findMany({
      where: { taxpayerId, taxPeriodId: periodId },
      orderBy: { issueDate: 'asc' },
    })
  );
}

/**
 * Marks the destination of one or more sales with IVA = 0
 * (docs/guides/code-flow.md -> Issued sales). Every mark writes an audit
 * log event (ADR-013) -- no marking happens without a record.
 */
export async function markSalesTreatment(
  invoiceIds: string[],
  treatment: SalesTreatment,
  taxpayerId: string,
  periodId: string
) {
  const userId = await getCurrentUserId();

  await withUser(userId, async (tx) => {
    for (const id of invoiceIds) {
      const invoice = await tx.invoiceIssued.findUniqueOrThrow({ where: { id } });
      await tx.invoiceIssued.update({
        where: { id },
        data: { salesTreatment: treatment },
      });
      await tx.classificationEvent.create({
        data: {
          issuedInvoiceId: id,
          taxpayerId,
          taxPeriodId: periodId,
          field: 'salesTreatment',
          oldValue: invoice.salesTreatment,
          newValue: treatment,
          actorType: 'USER',
          actorUserId: userId,
          reason: 'Manually marked by the user',
        },
      });
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/ventas`);
}
