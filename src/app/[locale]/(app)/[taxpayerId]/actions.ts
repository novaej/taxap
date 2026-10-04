'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { computeActivityFingerprint } from '@/domain/iva';
import type { TaxRegime, Periodicity } from '@prisma/client';

export async function getTaxpayer(taxpayerId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } }));
}

export interface UpdateTaxpayerInput {
  ruc: string;
  businessName: string;
  tradeName?: string;
  regime: TaxRegime;
  ivaPeriodicity: Periodicity;
  economicActivities: Array<{ code: string; description: string }>;
}

export interface UpdateTaxpayerResult {
  success: boolean;
  error?: 'RUC_IN_USE' | 'UNKNOWN';
}

export async function updateTaxpayer(
  taxpayerId: string,
  input: UpdateTaxpayerInput
): Promise<UpdateTaxpayerResult> {
  const userId = await getCurrentUserId();
  const activityFingerprint = computeActivityFingerprint(
    input.economicActivities.map((a) => a.code)
  );

  try {
    await withUser(userId, async (tx) => {
      const existing = await tx.taxpayer.findUnique({ where: { ruc: input.ruc } });
      if (existing && existing.id !== taxpayerId) {
        throw new Error('RUC_IN_USE');
      }
      await tx.taxpayer.update({
        where: { id: taxpayerId },
        data: {
          ruc: input.ruc,
          businessName: input.businessName,
          tradeName: input.tradeName || null,
          regime: input.regime,
          ivaPeriodicity: input.ivaPeriodicity,
          economicActivities: input.economicActivities,
          activityFingerprint,
        },
      });
    });

    revalidatePath(`/${taxpayerId}/periodos`);
    revalidatePath(`/${taxpayerId}/editar`);
    revalidatePath('/taxpayers');
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'RUC_IN_USE') {
      return { success: false, error: 'RUC_IN_USE' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}
