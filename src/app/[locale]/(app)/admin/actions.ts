'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { PDFParse } from 'pdf-parse';
import { asAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { extractCandidateFields } from '@/services/forms/pdf-field-extractor';
import type { ColumnKind, TaxRateType } from '@prisma/client';

/**
 * System administration (ADR-015): the admin uploads/publishes the form
 * and loads verified rates. They never see taxpayer data -- everything
 * here runs with `asAdmin()`, never `withUser()`.
 */

export async function getFormVersions() {
  await requireAdmin();
  return asAdmin((tx) => tx.formVersion.findMany({
      orderBy: { validFrom: 'desc' },
      include: { _count: { select: { formFields: true } } },
    }));
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
  candidateFieldCount?: number;
  error?: 'ALREADY_EXISTS' | 'EMPTY_FILE' | 'UNKNOWN';
}

/**
 * Uploads the PDF, computes its sha256 (ADR-015: "the original PDF is
 * never stored") and makes a first automatic attempt at extracting its
 * fields from the text layer (`extractCandidateFields`). The extraction
 * is heuristic, with no real position/layout data behind it -- a scanned
 * PDF with no text produces nothing, and an ambiguous row can come out
 * with the wrong code or column kind. That's why every row stays
 * editable and deletable on the next screen: the admin reviews and
 * corrects before publishing, the extraction is never trusted on its own.
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

  let candidates: ReturnType<typeof extractCandidateFields> = [];
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    candidates = extractCandidateFields(result.text);
  } catch {
    // Scanned PDF with no text layer, or an unreadable file -- the draft
    // is still created empty; the admin enters fields by hand instead.
    candidates = [];
  }

  try {
    const version = await asAdmin(async (tx) => {
      const created = await tx.formVersion.create({
        data: {
          formCode: input.formCode,
          label: input.label,
          validFrom: new Date(input.validFrom),
          status: 'DRAFT',
          sourceSha256,
          importedBy: userId,
          importedAt: new Date(),
        },
      });
      if (candidates.length > 0) {
        await tx.formField.createMany({
          data: candidates.map((c, i) => ({
            formVersionId: created.id,
            code: c.code,
            label: c.label,
            columnKind: c.columnKind,
            displayOrder: i,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });
    revalidatePath('/admin/formularios');
    return { success: true, formVersionId: version.id, candidateFieldCount: candidates.length };
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
 * Last validation before publishing (ADR-015 step 3): at least one
 * field. Unique codes are already guaranteed by
 * `@@unique([formVersionId, code])` in the schema -- `addFormField` never
 * lets a duplicate get inserted, so there's no need to revalidate that
 * here. Doesn't yet validate the GROSS/NET/TAX pattern (NEXT_STEPS.md) --
 * that requires knowing which triplets are mandatory per section, which
 * isn't modeled yet.
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
 * Never called with an unverified value -- the screen won't submit the
 * form without `source`/`verifiedAt` (CLAUDE.md -> "Normative values").
 * No data is seeded: no rate in docs/tax/tasas-iva.md is verified yet.
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

export interface DeleteResult {
  success: boolean;
  error?: 'IN_USE' | 'UNKNOWN';
}

/**
 * Deletes a form version together with its fields and mappings (cascade).
 * Refused while any taxpayer period points at it -- those periods'
 * pre-declaration was built against that exact catalog.
 */
export async function deleteFormVersion(formVersionId: string): Promise<DeleteResult> {
  await requireAdmin();
  try {
    const inUse = await asAdmin((tx) => tx.taxPeriod.count({ where: { formVersionId } }));
    if (inUse > 0) return { success: false, error: 'IN_USE' };
    await asAdmin((tx) => tx.formVersion.delete({ where: { id: formVersionId } }));
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/formularios');
  return { success: true };
}

export async function deleteTaxRate(tax: TaxRateType, validFrom: string): Promise<DeleteResult> {
  await requireAdmin();
  try {
    await asAdmin((tx) =>
      tx.taxRate.delete({ where: { tax_validFrom: { tax, validFrom: new Date(validFrom) } } })
    );
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/tasas');
  return { success: true };
}

export interface UpdateResult {
  success: boolean;
  error?: 'PUBLISHED' | 'DUPLICATE' | 'UNKNOWN';
}

async function isPublished(formVersionId: string) {
  const v = await asAdmin((tx) =>
    tx.formVersion.findUniqueOrThrow({ where: { id: formVersionId }, select: { status: true } })
  );
  return v.status === 'PUBLISHED';
}

/** Published versions are immutable (ADR-015): a correction is a new version. */
export async function updateFormVersion(
  formVersionId: string,
  input: { label: string; validFrom: string }
): Promise<UpdateResult> {
  await requireAdmin();
  if (await isPublished(formVersionId)) return { success: false, error: 'PUBLISHED' };
  try {
    await asAdmin((tx) =>
      tx.formVersion.update({
        where: { id: formVersionId },
        data: { label: input.label, validFrom: new Date(input.validFrom) },
      })
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'DUPLICATE' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/formularios');
  revalidatePath(`/admin/formularios/${formVersionId}`);
  return { success: true };
}

export async function updateFormField(
  formVersionId: string,
  fieldId: string,
  input: { code: string; label: string; section?: string; columnKind: ColumnKind }
): Promise<UpdateResult> {
  await requireAdmin();
  if (await isPublished(formVersionId)) return { success: false, error: 'PUBLISHED' };
  try {
    await asAdmin((tx) =>
      tx.formField.update({
        where: { id: fieldId },
        data: {
          code: input.code,
          label: input.label,
          section: input.section || null,
          columnKind: input.columnKind,
        },
      })
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'DUPLICATE' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath(`/admin/formularios/${formVersionId}`);
  return { success: true };
}

/** The `(tax, valid_from)` key is not editable; change it by delete + create. */
export async function updateTaxRate(
  tax: TaxRateType,
  validFrom: string,
  input: { rate: string; validTo?: string; source: string; verifiedAt: string }
): Promise<UpdateResult> {
  await requireAdmin();
  try {
    await asAdmin((tx) =>
      tx.taxRate.update({
        where: { tax_validFrom: { tax, validFrom: new Date(validFrom) } },
        data: {
          rate: input.rate,
          validTo: input.validTo ? new Date(input.validTo) : null,
          source: input.source,
          verifiedAt: new Date(input.verifiedAt),
        },
      })
    );
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/tasas');
  return { success: true };
}
