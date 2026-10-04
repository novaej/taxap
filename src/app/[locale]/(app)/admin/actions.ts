'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { asAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import type { ColumnKind, TaxRateType } from '@prisma/client';

/**
 * Administración del sistema (ADR-015): el admin sube/publica el
 * formulario y carga tasas verificadas. No ve datos de contribuyentes --
 * todo aquí corre con `asAdmin()`, nunca con `withUser()`.
 */

export async function getFormVersions() {
  await requireAdmin();
  return asAdmin((tx) => tx.formVersion.findMany({ orderBy: { validFrom: 'desc' } }));
}

export async function getFormVersion(formVersionId: string) {
  await requireAdmin();
  return asAdmin((tx) =>
    tx.formVersion.findUniqueOrThrow({
      where: { id: formVersionId },
      include: { formFields: { orderBy: { displayOrder: 'asc' } } },
    })
  );
}

export interface CreateFormVersionDraftResult {
  success: boolean;
  formVersionId?: string;
  error?: 'ALREADY_EXISTS' | 'EMPTY_FILE' | 'UNKNOWN';
}

/**
 * Sube el PDF solo para calcular su sha256 (ADR-015: "el PDF original no
 * se guarda"). No hay extracción automática del texto todavía
 * (NEXT_STEPS.md) -- el admin agrega cada campo a mano en la pantalla
 * siguiente, revisándolos antes de publicar.
 */
export async function createFormVersionDraft(input: {
  formCode: string;
  label: string;
  validFrom: string;
  formData: FormData;
}): Promise<CreateFormVersionDraftResult> {
  const userId = await requireAdmin();

  const file = input.formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: 'EMPTY_FILE' };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  try {
    const version = await asAdmin((tx) =>
      tx.formVersion.create({
        data: {
          formCode: input.formCode,
          label: input.label,
          validFrom: new Date(input.validFrom),
          status: 'DRAFT',
          sourceSha256,
          importedBy: userId,
          importedAt: new Date(),
        },
      })
    );
    revalidatePath('/admin/formularios');
    return { success: true, formVersionId: version.id };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}

export interface AddFormFieldInput {
  formVersionId: string;
  code: string;
  label: string;
  section?: string;
  columnKind: ColumnKind;
  displayOrder: number;
}

export interface AddFormFieldResult {
  success: boolean;
  field?: { id: string; code: string; label: string; section: string | null; columnKind: ColumnKind; displayOrder: number };
  error?: 'DUPLICATE_CODE' | 'UNKNOWN';
}

export async function addFormField(input: AddFormFieldInput): Promise<AddFormFieldResult> {
  await requireAdmin();
  try {
    const field = await asAdmin((tx) =>
      tx.formField.create({
        data: {
          formVersionId: input.formVersionId,
          code: input.code,
          label: input.label,
          section: input.section || null,
          columnKind: input.columnKind,
          displayOrder: input.displayOrder,
        },
      })
    );
    revalidatePath(`/admin/formularios/${input.formVersionId}`);
    return { success: true, field };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'DUPLICATE_CODE' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}

export async function removeFormField(formVersionId: string, fieldId: string) {
  await requireAdmin();
  await asAdmin((tx) => tx.formField.delete({ where: { id: fieldId } }));
  revalidatePath(`/admin/formularios/${formVersionId}`);
}

export interface PublishFormVersionResult {
  success: boolean;
  error?: 'NO_FIELDS' | 'UNKNOWN';
}

/**
 * Última validación antes de publicar (ADR-015 paso 3): al menos un
 * campo. Códigos únicos ya los garantiza `@@unique([formVersionId, code])`
 * en el esquema -- `addFormField` nunca deja insertar un duplicado, así
 * que no hace falta revalidarlo aquí. No valida el patrón GROSS/NET/TAX
 * todavía (NEXT_STEPS.md) -- eso requiere saber qué tríos son obligatorios
 * por sección, que no está modelado aún.
 */
export async function publishFormVersion(formVersionId: string): Promise<PublishFormVersionResult> {
  await requireAdmin();

  const fields = await asAdmin((tx) =>
    tx.formField.findMany({ where: { formVersionId } })
  );
  if (fields.length === 0) {
    return { success: false, error: 'NO_FIELDS' };
  }

  await asAdmin((tx) =>
    tx.formVersion.update({
      where: { id: formVersionId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
  );
  revalidatePath('/admin/formularios');
  revalidatePath(`/admin/formularios/${formVersionId}`);
  return { success: true };
}

export async function getTaxRates() {
  await requireAdmin();
  return asAdmin((tx) => tx.taxRate.findMany({ orderBy: { validFrom: 'desc' } }));
}

export interface CreateTaxRateInput {
  tax: TaxRateType;
  rate: string;
  validFrom: string;
  validTo?: string;
  source: string;
  verifiedAt: string;
}

export interface CreateTaxRateResult {
  success: boolean;
  error?: 'ALREADY_EXISTS' | 'UNKNOWN';
}

/**
 * Nunca se llama con un valor sin verificar -- la pantalla no deja enviar
 * el formulario sin `source`/`verifiedAt` (CLAUDE.md -> "Valores
 * normativos"). No hay ningún dato sembrado: ninguna tasa en
 * docs/tax/tasas-iva.md está verificada todavía.
 */
export async function createTaxRate(input: CreateTaxRateInput): Promise<CreateTaxRateResult> {
  const userId = await requireAdmin();

  try {
    await asAdmin((tx) =>
      tx.taxRate.create({
        data: {
          tax: input.tax,
          rate: input.rate,
          validFrom: new Date(input.validFrom),
          validTo: input.validTo ? new Date(input.validTo) : null,
          source: input.source,
          verifiedAt: new Date(input.verifiedAt),
          createdBy: userId,
        },
      })
    );
    revalidatePath('/admin/tasas');
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}
