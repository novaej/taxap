/**
 * VAT (IVA) calculation engine.
 * Pure domain logic: receives classified invoices, outputs results.
 *
 * Produces stable result keys: PURCHASES_WITH_CREDIT, SALES_TAXED, PROPORTIONALITY_FACTOR, etc.
 */

import Decimal from 'decimal.js';
import {
  CalculationResult,
  IvaCategoryEnum,
  ResultKeyType,
  RESULT_KEYS,
} from '../types';
import { SaleForFactor, calculateProportionalityFactor } from './proportionality';
import { SalesTreatmentEnum } from '../types';

/**
 * Classified invoice for calculation.
 */
export interface ClassifiedInvoice {
  id: string;
  type: 'RECEIVED' | 'ISSUED';
  subtotal: Decimal;
  vat: Decimal;
  // For received invoices:
  ivaCategory?: IvaCategoryEnum;
  // For issued invoices:
  salesTreatment?: SalesTreatmentEnum;
}

/**
 * Calculation context for a tax period.
 */
export interface CalculationContext {
  periodId: string;
  invoices: ClassifiedInvoice[];
}

/**
 * Calculate all results for a tax period.
 * Returns a map of result_key → value.
 */
export function calculatePeriodResults(
  context: CalculationContext
): Map<ResultKeyType, CalculationResult> {
  const results = new Map<ResultKeyType, CalculationResult>();

  // Separate by type
  const received = context.invoices.filter((i) => i.type === 'RECEIVED');
  const issued = context.invoices.filter((i) => i.type === 'ISSUED');

  // ========================================================================
  // RECEIVED INVOICES (PURCHASES)
  // ========================================================================

  const withCredit = received.filter(
    (i) => i.ivaCategory === IvaCategoryEnum.CREDIT
  );
  const noCreditValue = received.filter(
    (i) => i.ivaCategory === IvaCategoryEnum.COST_EXPENSE
  );

  // Purchases with credit (500 - bruto, 510 - neto, 520 - impuesto)
  const purchasesWithCreditBruto = sumSubtotal(withCredit);
  const purchasesWithCreditVat = sumVat(withCredit);

  results.set('PURCHASES_WITH_CREDIT', {
    key: 'PURCHASES_WITH_CREDIT',
    value: purchasesWithCreditBruto,
    componentIds: withCredit.map((i) => i.id),
  });

  // Purchases without credit (502 - bruto, 512 - neto, 522 - impuesto)
  const purchasesNoCreditBruto = sumSubtotal(noCreditValue);
  const purchasesNoCreditVat = sumVat(noCreditValue);

  results.set('PURCHASES_NO_CREDIT', {
    key: 'PURCHASES_NO_CREDIT',
    value: purchasesNoCreditBruto,
    componentIds: noCreditValue.map((i) => i.id),
  });

  // Purchases with IVA = 0 (informativo, no casillero)
  const purchasesZeroVat = received.filter(
    (i) => i.ivaCategory === IvaCategoryEnum.NOT_APPLICABLE
  );
  const purchasesZeroTotal = sumSubtotal(purchasesZeroVat);

  results.set('PURCHASES_ZERO_VAT', {
    key: 'PURCHASES_ZERO_VAT',
    value: purchasesZeroTotal,
    componentIds: purchasesZeroVat.map((i) => i.id),
  });

  // ========================================================================
  // ISSUED INVOICES (SALES)
  // ========================================================================

  // Sales taxed (IVA > 0)
  const salesTaxed = issued.filter(
    (i) => i.salesTreatment === SalesTreatmentEnum.TAXED
  );
  results.set('SALES_TAXED', {
    key: 'SALES_TAXED',
    value: sumSubtotal(salesTaxed),
    componentIds: salesTaxed.map((i) => i.id),
  });

  // Sales 0% without credit (403)
  const salesZeroNoCredit = issued.filter(
    (i) => i.salesTreatment === SalesTreatmentEnum.ZERO_NO_CREDIT
  );
  results.set('SALES_ZERO_NO_CREDIT', {
    key: 'SALES_ZERO_NO_CREDIT',
    value: sumSubtotal(salesZeroNoCredit),
    componentIds: salesZeroNoCredit.map((i) => i.id),
  });

  // Sales 0% with credit (405)
  const salesZeroWithCredit = issued.filter(
    (i) => i.salesTreatment === SalesTreatmentEnum.ZERO_WITH_CREDIT
  );
  results.set('SALES_ZERO_WITH_CREDIT', {
    key: 'SALES_ZERO_WITH_CREDIT',
    value: sumSubtotal(salesZeroWithCredit),
    componentIds: salesZeroWithCredit.map((i) => i.id),
  });

  // Export goods (407)
  const exportGoods = issued.filter(
    (i) => i.salesTreatment === SalesTreatmentEnum.EXPORT_GOODS
  );
  results.set('EXPORT_GOODS', {
    key: 'EXPORT_GOODS',
    value: sumSubtotal(exportGoods),
    componentIds: exportGoods.map((i) => i.id),
  });

  // Export services (408)
  const exportServices = issued.filter(
    (i) => i.salesTreatment === SalesTreatmentEnum.EXPORT_SERVICES
  );
  results.set('EXPORT_SERVICES', {
    key: 'EXPORT_SERVICES',
    value: sumSubtotal(exportServices),
    componentIds: exportServices.map((i) => i.id),
  });

  // ========================================================================
  // PROPORTIONALITY FACTOR
  // ========================================================================

  const salesForFactor: SaleForFactor[] = issued.map((sale) => ({
    id: sale.id,
    subtotal: sale.subtotal,
    treatment: sale.salesTreatment || SalesTreatmentEnum.UNCLASSIFIED,
  }));

  const factorCalc = calculateProportionalityFactor(salesForFactor);

  if (!factorCalc.isBlocked) {
    results.set('PROPORTIONALITY_FACTOR', {
      key: 'PROPORTIONALITY_FACTOR',
      value: factorCalc.factor,
      metadata: {
        numerator: factorCalc.creditGeneratingSales.toString(),
        denominator: factorCalc.denominator.toString(),
      },
    });

    // Credited VAT = total purchase VAT * factor
    const totalPurchaseVat = purchasesWithCreditVat.plus(purchasesNoCreditVat);
    const creditedVat = totalPurchaseVat
      .multipliedBy(factorCalc.factor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    results.set('CREDIT_APPLICABLE', {
      key: 'CREDIT_APPLICABLE',
      value: creditedVat,
      metadata: {
        factor: factorCalc.factor.toString(),
        totalPurchaseVat: totalPurchaseVat.toString(),
      },
    });

    // Uncredited VAT
    const uncreditedVat = totalPurchaseVat
      .minus(creditedVat)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    results.set('VAT_NOT_CREDITED', {
      key: 'VAT_NOT_CREDITED',
      value: uncreditedVat,
    });
  } else {
    // Factor blocked: return placeholder results
    results.set('PROPORTIONALITY_FACTOR', {
      key: 'PROPORTIONALITY_FACTOR',
      value: new Decimal(0),
      metadata: {
        blocked: true,
        reason: factorCalc.blockReason,
      },
    });

    results.set('CREDIT_APPLICABLE', {
      key: 'CREDIT_APPLICABLE',
      value: new Decimal(0),
      metadata: { blocked: true },
    });

    results.set('VAT_NOT_CREDITED', {
      key: 'VAT_NOT_CREDITED',
      value: new Decimal(0),
      metadata: { blocked: true },
    });
  }

  return results;
}

/**
 * Sum subtotal (valor sin impuestos) from a list of invoices.
 */
function sumSubtotal(invoices: ClassifiedInvoice[]): Decimal {
  return invoices.reduce(
    (sum, inv) => sum.plus(inv.subtotal),
    new Decimal(0)
  );
}

/**
 * Sum VAT from a list of invoices.
 */
function sumVat(invoices: ClassifiedInvoice[]): Decimal {
  return invoices.reduce((sum, inv) => sum.plus(inv.vat), new Decimal(0));
}
