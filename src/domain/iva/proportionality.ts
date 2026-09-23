/**
 * Proportionality Factor (Factor de Proporcionalidad).
 * Controls how much purchase VAT can be credited based on the composition of sales.
 *
 * Formula: (411+412+420+435+415+416+417+418) / 419
 * where:
 *  411, 412, 420, 435 = different VAT rates, count in numerator
 *  415, 416 = 0% sales WITH credit right, count in numerator
 *  417, 418 = exports (goods, services), count in numerator
 *  419 = total sales (denominator)
 *  403, 404, 431 = 0% without credit, no object/exempt, do NOT count in numerator
 *
 * Business logic:
 * - Factor is 1.0000 if all sales give credit right (including exports)
 * - Factor is 0.0000 if all sales are 0% without credit or exempt
 * - Factor cannot be calculated if any sale with IVA=0 is unmarked (UNCLASSIFIED)
 * - 4 decimal places: 0.0000 to 1.0000
 *
 * Caveats:
 * - If there are no sales at all, denominator is 0 → undefined (needs user decision)
 * - Comprobantes are at total level only (no line items) per ADR-008
 */

import Decimal from 'decimal.js';
import { SalesTreatmentEnum } from '../types';

/**
 * Sales that count TOWARD numerator (give credit right)
 */
const CREDIT_GENERATING_SALES = new Set([
  SalesTreatmentEnum.TAXED,
  SalesTreatmentEnum.ZERO_WITH_CREDIT,
  SalesTreatmentEnum.EXPORT_GOODS,
  SalesTreatmentEnum.EXPORT_SERVICES,
]);

/**
 * Sales that do NOT count toward numerator (no credit right)
 */
const NO_CREDIT_SALES = new Set([
  SalesTreatmentEnum.ZERO_NO_CREDIT,
  SalesTreatmentEnum.NON_OBJECT_EXEMPT,
]);

export interface SaleForFactor {
  id: string;
  subtotal: Decimal;
  treatment: SalesTreatmentEnum;
}

export interface ProportionalityCalculation {
  factor: Decimal;
  numerator: Decimal;
  denominator: Decimal;
  isBlocked: boolean;
  blockReason?: string;
  creditGeneratingSales: Decimal;
  noCreditSales: Decimal;
  unclassifiedSalesCount: number;
}

/**
 * Calculate the proportionality factor.
 * Blocks if any sales with IVA=0 are UNCLASSIFIED.
 *
 * Returns:
 * - factor: The calculated factor (0.0000 to 1.0000) or 0 if blocked
 * - isBlocked: true if factor cannot be calculated
 * - blockReason: why it's blocked (if blocked)
 * - metadata: components for display
 */
export function calculateProportionalityFactor(
  sales: SaleForFactor[]
): ProportionalityCalculation {
  // Check for unclassified sales with IVA = 0
  const unclassifiedSalesCount = sales.filter(
    (s) => s.treatment === SalesTreatmentEnum.UNCLASSIFIED
  ).length;

  if (unclassifiedSalesCount > 0) {
    return {
      factor: new Decimal(0),
      numerator: new Decimal(0),
      denominator: new Decimal(0),
      isBlocked: true,
      blockReason: `${unclassifiedSalesCount} sales with IVA=0 are unmarked. Mark their destination before calculating the factor.`,
      creditGeneratingSales: new Decimal(0),
      noCreditSales: new Decimal(0),
      unclassifiedSalesCount,
    };
  }

  // Separate sales by category
  let creditGeneratingSubtotal = new Decimal(0);
  let noCreditSubtotal = new Decimal(0);
  let otherSubtotal = new Decimal(0);

  for (const sale of sales) {
    if (CREDIT_GENERATING_SALES.has(sale.treatment)) {
      creditGeneratingSubtotal = creditGeneratingSubtotal.plus(sale.subtotal);
    } else if (NO_CREDIT_SALES.has(sale.treatment)) {
      noCreditSubtotal = noCreditSubtotal.plus(sale.subtotal);
    } else {
      // Should not happen if validatio is correct
      otherSubtotal = otherSubtotal.plus(sale.subtotal);
    }
  }

  const denominator = creditGeneratingSubtotal.plus(noCreditSubtotal).plus(otherSubtotal);

  // Edge case: no sales at all
  if (denominator.isZero()) {
    return {
      factor: new Decimal(0),
      numerator: new Decimal(0),
      denominator: new Decimal(0),
      isBlocked: true,
      blockReason: 'No sales in this period. Factor cannot be calculated.',
      creditGeneratingSales: new Decimal(0),
      noCreditSales: new Decimal(0),
      unclassifiedSalesCount: 0,
    };
  }

  // Calculate factor with 4 decimal places
  const factor = creditGeneratingSubtotal
    .dividedBy(denominator)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    factor,
    numerator: creditGeneratingSubtotal,
    denominator,
    isBlocked: false,
    creditGeneratingSales: creditGeneratingSubtotal,
    noCreditSales: noCreditSubtotal,
    unclassifiedSalesCount: 0,
  };
}

/**
 * Apply the factor to a VAT amount to get the credited portion.
 * creditable_vat = total_purchase_vat * factor
 */
export function applyFactorToVat(
  totalPurchaseVat: Decimal,
  factor: Decimal
): Decimal {
  return totalPurchaseVat
    .multipliedBy(factor)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate VAT that is NOT credited due to factor.
 * uncredited_vat = total_purchase_vat * (1 - factor)
 */
export function calculateUncreditedVat(
  totalPurchaseVat: Decimal,
  factor: Decimal
): Decimal {
  const complement = new Decimal(1).minus(factor);
  return totalPurchaseVat
    .multipliedBy(complement)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
