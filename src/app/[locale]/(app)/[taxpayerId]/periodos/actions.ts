'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';

export async function getTaxpayer(taxpayerId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } }));
}

export async function getTaxpayerPeriods(taxpayerId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.taxPeriod.findMany({
      where: { taxpayerId },
      orderBy: { periodStart: 'desc' },
    })
  );
}

export interface CreatePeriodInput {
  taxpayerId: string;
  year: number;
  month: number;
}

export interface CreatePeriodResult {
  success: boolean;
  periodId?: string;
  error?: 'ALREADY_EXISTS' | 'UNKNOWN';
}

export async function createPeriod(input: CreatePeriodInput): Promise<CreatePeriodResult> {
  const userId = await getCurrentUserId();

  const periodStart = new Date(input.year, input.month - 1, 1);
  const periodEnd = new Date(input.year, input.month, 0);

  try {
    const period = await withUser(userId, async (tx) => {
      const existing = await tx.taxPeriod.findFirst({
        where: { taxpayerId: input.taxpayerId, taxType: 'IVA', periodStart },
      });
      if (existing) {
        throw new Error('ALREADY_EXISTS');
      }

      return tx.taxPeriod.create({
        data: {
          taxpayerId: input.taxpayerId,
          taxType: 'IVA',
          periodStart,
          periodEnd,
          periodicity: 'MONTHLY',
          status: 'DRAFT',
        },
      });
    });

    revalidatePath(`/${input.taxpayerId}/periodos`);
    return { success: true, periodId: period.id };
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_EXISTS') {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}
