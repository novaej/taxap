/**
 * Provider-agnostic AI classification interface (ADR-005 level 3, ADR-007).
 * Every provider implementation (Claude, OpenAI, ...) returns this same
 * shape, so `getAiClassifier()`'s caller never knows which one answered.
 *
 * ADR-007 data minimization: the request carries the supplier's identity
 * and the buyer's economic activity and regime (what the decision
 * depends on), never the taxpayer's own RUC or name.
 */

export interface SupplierClassificationRequest {
  supplierRuc: string;
  supplierName: string;
  documentType: string;
  /** The buyer's registered activities -- never the buyer's RUC or name. */
  buyerActivities: Array<{ code: string; description: string }>;
  buyerRegime: string;
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
export const PROMPT_VERSION = 'supplier-classification-v2';

export function buildClassificationPrompt(request: SupplierClassificationRequest): string {
  const activities =
    request.buyerActivities.length > 0
      ? request.buyerActivities.map((a) => `- ${a.code}: ${a.description}`).join('\n')
      : '- (none registered)';

  return `You are classifying purchase vouchers received by an Ecuadorian taxpayer, for IVA (VAT) tax-credit eligibility. The buyer is identified only by its economic activity and tax regime.

Buyer's economic activities:
${activities}
Buyer's tax regime: ${request.buyerRegime}

Supplier RUC: ${request.supplierRuc}
Supplier name: ${request.supplierName}
Document type: ${request.documentType}

Decide which category best fits purchases from this supplier, for this buyer:
- CREDIT: what this supplier typically sells plausibly serves the buyer's economic activity, so the IVA paid gives a right to tax credit.
- COST_EXPENSE: a valid business cost or expense for this buyer, but the IVA paid does NOT give a right to tax credit.
- NON_DEDUCTIBLE: what this supplier typically sells does not relate to the buyer's economic activity (for example personal consumption such as groceries, restaurants or fuel for a buyer whose activity doesn't need them).

Judge whether the supplier's usual goods or services fit the buyer's activity -- a supplier being an ordinary company is not enough for CREDIT. You only know the supplier's name, not what was bought, so when the purpose is genuinely ambiguous (supermarkets, restaurants, fuel, general retail) answer with a low confidence value rather than guessing with high confidence.`;
}
