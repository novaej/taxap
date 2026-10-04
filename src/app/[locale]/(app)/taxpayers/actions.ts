'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { computeActivityFingerprint } from '@/domain/iva';
import type { TaxRegime, Periodicity } from '@prisma/client';

export async function getMyTaxpayers() {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.taxpayer.findMany({
      where: { userTaxpayers: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    })
  );
}

export interface CreateTaxpayerInput {
  ruc: string;
  businessName: string;
  tradeName?: string;
  regime: TaxRegime;
  ivaPeriodicity: Periodicity;
  economicActivities: Array<{ code: string; description: string }>;
}

export interface CreateTaxpayerResult {
  success: boolean;
  taxpayerId?: string;
  error?: 'RUC_IN_USE' | 'UNKNOWN';
}

/**
 * Taxpayer sign-up (original mvp-scope, §1): RUC, business name, tax
 * regime, IVA periodicity, and economic activities, exactly as the SRI
 * assigned them to the user -- editable afterward.
 */
export async function createTaxpayer(
  input: CreateTaxpayerInput
): Promise<CreateTaxpayerResult> {
  const userId = await getCurrentUserId();

  const activityFingerprint = computeActivityFingerprint(
    input.economicActivities.map((a) => a.code)
  );

  try {
    const taxpayer = await withUser(userId, async (tx) => {
      const existing = await tx.taxpayer.findUnique({ where: { ruc: input.ruc } });
      if (existing) {
        throw new Error('RUC_IN_USE');
      }

      const taxpayer = await tx.taxpayer.create({
        data: {
          ruc: input.ruc,
          businessName: input.businessName,
          tradeName: input.tradeName || null,
          regime: input.regime,
          ivaPeriodicity: input.ivaPeriodicity,
          economicActivities: input.economicActivities,
          activityFingerprint,
          createdBy: userId,
        },
      });
      await tx.userTaxpayer.create({
        data: { userId, taxpayerId: taxpayer.id },
      });
      return taxpayer;
    });

    revalidatePath('/taxpayers');
    return { success: true, taxpayerId: taxpayer.id };
  } catch (err) {
    if (err instanceof Error && err.message === 'RUC_IN_USE') {
      return { success: false, error: 'RUC_IN_USE' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}
