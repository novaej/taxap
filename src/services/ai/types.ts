/**
 * Provider-agnostic AI classification interface (ADR-005 level 3, ADR-007).
 * Every provider implementation (Claude, OpenAI, ...) returns this same
 * shape, so `getAiClassifier()`'s caller never knows which one answered.
 *
 * ADR-007 privacy rule: only supplier identity goes in the request, never
 * the taxpayer's own RUC or name -- classification is per supplier, not
 * per taxpayer.
 */

export interface SupplierClassificationRequest {
  supplierRuc: string;
  supplierName: string;
  documentType: string;
}

export type AiIvaCategory = 'CREDIT' | 'COST_EXPENSE' | 'NON_DEDUCTIBLE';

export interface SupplierClassificationResult {
  category: AiIvaCategory;
  confidence: number; // 0-1
  reasoning: string;
  modelId: string;
  promptVersion: string;
}

export interface AiClassifier {
  classifySupplier(
    request: SupplierClassificationRequest
  ): Promise<SupplierClassificationResult | null>;
}

/**
 * Bumped whenever the classification prompt's wording or schema changes,
 * so a stored classification_events row says which prompt produced it
 * (CLAUDE.md -> "Toda respuesta registra model_id y prompt_version").
 */
export const PROMPT_VERSION = 'supplier-classification-v1';

export function buildClassificationPrompt(request: SupplierClassificationRequest): string {
  return `You are classifying a single purchase voucher for Ecuadorian IVA (VAT) tax-credit eligibility, based only on the supplier's identity and document type -- never on the buyer.

Supplier RUC: ${request.supplierRuc}
Supplier name: ${request.supplierName}
Document type code (SRI): ${request.documentType}

Decide which of these three categories best fits purchases from this supplier:
- CREDIT: the IVA paid normally gives the buyer a right to tax credit (e.g. ordinary goods/services suppliers).
- COST_EXPENSE: the purchase is a valid business cost or expense, but the IVA paid does NOT give a right to tax credit (e.g. the activity or the item purchased doesn't entitle credit under Ecuadorian tax law).
- NON_DEDUCTIBLE: the purchase is not deductible at all for this business (e.g. personal, unrelated to any taxable activity).

Respond with your best judgment from the supplier's name and document type alone. If you are genuinely unsure, say so with a low confidence value rather than guessing with high confidence.`;
}
