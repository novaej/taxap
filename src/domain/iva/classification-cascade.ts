/**
 * Classification cascade for received invoices (compras).
 * ADR-005: Four-level decision tree for IVA category.
 *
 * Level 1: Supplier rule (learned from prior classification)
 * Level 2: Shared catalog (crowdsourced anonymously)
 * Level 3: AI (Claude Haiku + structured output, optional)
 * Level 4: Manual bandeja (user intervention)
 */

import Decimal from 'decimal.js';
import { IvaCategoryEnum } from '../types';

/**
 * Classification input: invoice metadata + fingerprint.
 */
export interface ClassificationInput {
  invoiceId: string;
  emitterRuc: string;
  emitterName: string;
  documentType: string;
  series: string;
  subtotal: Decimal;
  vat: Decimal;
  documentTypeRecognized: boolean; // From whitelist validation (ADR-010)
  activityFingerprint: string; // Hash of taxpayer's activities
}

/**
 * Classification decision with provenance.
 */
export interface ClassificationDecision {
  invoiceId: string;
  category: IvaCategoryEnum;
  method: 'RULE' | 'CATALOG' | 'AI' | 'MANUAL';
  confidence?: number; // 0.00-1.00, only for AI
  reason: string;
}

/**
 * Supplier rule (learned decision).
 */
export interface SupplierRule {
  taxpayerId: string;
  emitterRuc: string;
  activityFingerprint: string;
  category: IvaCategoryEnum;
}

/**
 * Catalog entry (anonymous crowdsource).
 */
export interface CatalogEntry {
  ruc: string;
  name: string;
  suggestedCategory: IvaCategoryEnum;
  frequency: number; // How many users classified this way
}

/**
 * Classification cascade implementation.
 * Pure domain logic: no database, no I/O, no AI calls here.
 * (AI is called externally; this function receives the decision.)
 */
export class ClassificationCascade {
  /**
   * Level 1: Check supplier rule.
   * Returns decision if rule exists and fingerprint matches.
   */
  level1_supplierRule(
    input: ClassificationInput,
    rule: SupplierRule | null
  ): ClassificationDecision | null {
    if (
      !rule ||
      rule.emitterRuc !== input.emitterRuc ||
      rule.activityFingerprint !== input.activityFingerprint
    ) {
      return null;
    }

    return {
      invoiceId: input.invoiceId,
      category: rule.category,
      method: 'RULE',
      reason: `Supplier rule: ${input.emitterName} (${input.emitterRuc}) has been classified as ${rule.category}`,
    };
  }

  /**
   * Level 2: Check shared catalog.
   * Ranks by frequency; uses highest-frequency suggestion.
   */
  level2_sharedCatalog(
    input: ClassificationInput,
    catalogEntries: CatalogEntry[]
  ): ClassificationDecision | null {
    const matching = catalogEntries.filter((c) => c.ruc === input.emitterRuc);

    if (matching.length === 0) {
      return null;
    }

    // Sort by frequency, pick the most common
    const best = matching.sort((a, b) => b.frequency - a.frequency)[0];

    // Only suggest if frequency is >= 3 (at least 3 users agree)
    if (best.frequency < 3) {
      return null;
    }

    return {
      invoiceId: input.invoiceId,
      category: best.suggestedCategory,
      method: 'CATALOG',
      reason: `Shared catalog: ${best.name} classified as ${best.suggestedCategory} by ${best.frequency} users`,
    };
  }

  /**
   * Level 3: AI suggestion.
   * Called externally; this function receives the AI's decision.
   * Requires confidence >= 0.80 to accept.
   */
  level3_aiSuggestion(
    input: ClassificationInput,
    aiDecision: { category: IvaCategoryEnum; confidence: number } | null
  ): ClassificationDecision | null {
    if (!aiDecision || aiDecision.confidence < 0.80) {
      return null;
    }

    return {
      invoiceId: input.invoiceId,
      category: aiDecision.category,
      method: 'AI',
      confidence: aiDecision.confidence,
      reason: `AI suggestion (${(aiDecision.confidence * 100).toFixed(0)}% confidence) for ${input.emitterName}`,
    };
  }

  /**
   * Run the full cascade.
   * Returns the first match from levels 1-3, or null if no match.
   */
  classify(
    input: ClassificationInput,
    supplierRule: SupplierRule | null,
    catalogEntries: CatalogEntry[],
    aiDecision: { category: IvaCategoryEnum; confidence: number } | null
  ): ClassificationDecision | null {
    // Level 1: Supplier rule
    const decision1 = this.level1_supplierRule(input, supplierRule);
    if (decision1) return decision1;

    // Level 2: Shared catalog
    const decision2 = this.level2_sharedCatalog(input, catalogEntries);
    if (decision2) return decision2;

    // Level 3: AI
    const decision3 = this.level3_aiSuggestion(input, aiDecision);
    if (decision3) return decision3;

    // Level 4: No decision, goes to manual bandeja
    return null;
  }
}

export const classificationCascade = new ClassificationCascade();

/**
 * A voucher type outside the ingestion whitelist (ADR-010,
 * services/ingestion/ingestion-service.ts VOUCHER_TYPE_WHITELIST) is never
 * rejected outright, but it does need manual review instead of running
 * through the cascade — this is the single source of truth for
 * "recognized", not a second, narrower list.
 */
export function requiresManualReview(documentTypeRecognized: boolean): boolean {
  return !documentTypeRecognized;
}
