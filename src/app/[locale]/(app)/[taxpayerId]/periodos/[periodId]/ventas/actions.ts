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
 * Marca el destino de una o varias ventas con IVA = 0 (docs/site/screens/
 * ventas-emitidas.md). Cada marca escribe un evento en la bitácora
 * (ADR-013) — no hay marcado sin registro.
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
          reason: 'Marcado manual por el usuario',
        },
      });
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/ventas`);
}
