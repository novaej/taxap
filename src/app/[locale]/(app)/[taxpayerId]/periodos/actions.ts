'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';

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

  // UTC explícito: Prisma lee un @db.Date como medianoche UTC, así que
  // construirlo en hora local desalinearía el mes mostrado en cualquier
  // huso horario detrás de UTC (medianoche local de agosto cae en la
  // noche de julio en UTC).
  const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
  const periodEnd = new Date(Date.UTC(input.year, input.month, 0));

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

export interface UpdatePeriodStatusResult {
  success: boolean;
  error?: 'PERIOD_FILED' | 'UNKNOWN';
}

/**
 * Transición manual DRAFT <-> UNDER_REVIEW. FILED es aparte (lockPeriod,
 * en el actions.ts del período): fija locked_at y dispara el candado de
 * Postgres de ADR-013, que esta función deliberadamente no toca.
 */
export async function updatePeriodStatus(
  taxpayerId: string,
  periodId: string,
  status: 'DRAFT' | 'UNDER_REVIEW'
): Promise<UpdatePeriodStatusResult> {
  const userId = await getCurrentUserId();

  try {
    await withUser(userId, async (tx) => {
      const period = await tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } });
      if (period.status === 'FILED') {
        throw new Error('PERIOD_FILED');
      }
      await tx.taxPeriod.update({ where: { id: periodId }, data: { status } });
      await tx.classificationEvent.create({
        data: {
          taxpayerId,
          taxPeriodId: periodId,
          field: 'status',
          oldValue: period.status,
          newValue: status,
          actorType: 'USER',
          actorUserId: userId,
          reason: 'Estado actualizado manualmente',
        },
      });
    });

    revalidatePath(`/${taxpayerId}/periodos`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'PERIOD_FILED') {
      return { success: false, error: 'PERIOD_FILED' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}

export interface DeletePeriodResult {
  success: boolean;
  error?: 'HAS_DATA' | 'NOT_DRAFT' | 'UNKNOWN';
}

/**
 * Solo borra períodos en borrador y sin comprobantes -- un período con
 * datos o ya declarado no se borra, se reabre (reopenPeriod) si hace
 * falta corregirlo.
 */
export async function deletePeriod(
  taxpayerId: string,
  periodId: string
): Promise<DeletePeriodResult> {
  const userId = await getCurrentUserId();

  try {
    await withUser(userId, async (tx) => {
      const period = await tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } });
      if (period.status !== 'DRAFT') {
        throw new Error('NOT_DRAFT');
      }

      const [receivedCount, issuedCount] = await Promise.all([
        tx.invoiceReceived.count({ where: { taxPeriodId: periodId } }),
        tx.invoiceIssued.count({ where: { taxPeriodId: periodId } }),
      ]);
      if (receivedCount > 0 || issuedCount > 0) {
        throw new Error('HAS_DATA');
      }

      await tx.taxPeriod.delete({ where: { id: periodId } });
    });

    revalidatePath(`/${taxpayerId}/periodos`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err.message === 'HAS_DATA' || err.message === 'NOT_DRAFT')) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}
