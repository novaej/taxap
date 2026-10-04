/**
 * Core domain types.
 * No imports from @prisma/client, next, or infrastructure.
 * Receives plain objects, returns structured decisions.
 */

import Decimal from 'decimal.js';

// ============================================================================
// Tax Rates (ADR-012)
// ============================================================================

export interface TaxRate {
  rateType: string; // "IVA"
  rate: Decimal;
  validFrom: Date;
  validTo: Date | null;
}

// ============================================================================
// Invoices (ADR-008: only totals, no line items)
// ============================================================================

export interface InvoiceReceived {
  id: string;
  accessKey: string;
  emitterRuc: string;
  emitterName: string;
  emissionDate: Date;
  documentType: string;
  series: string;
  subtotal: Decimal; // VALOR_SIN_IMPUESTOS
  vat: Decimal; // IVA (store as-is, no derivation)
  total: Decimal;
}

export interface InvoiceIssued {
  id: string;
  accessKey: string;
  emissionDate: Date;
  series: string;
  subtotal: Decimal;
  vat: Decimal;
  total: Decimal;
  // salesTreatment is not in domain, it's a classification result
}

// ============================================================================
// Classification Cascade (ADR-005, ADR-006)
// ============================================================================

export enum IvaCategoryEnum {
  CREDIT = 'CREDIT', // 500: with right to credit
  COST_EXPENSE = 'COST_EXPENSE', // 502: no right to credit
  NOT_APPLICABLE = 'NOT_APPLICABLE', // IVA = 0
  UNCLASSIFIED = 'UNCLASSIFIED',
  NON_DEDUCTIBLE = 'NON_DEDUCTIBLE',
}

export enum SalesTreatmentEnum {
  TAXED = 'TAXED', // IVA > 0
  ZERO_NO_CREDIT = 'ZERO_NO_CREDIT', // 403
  ZERO_WITH_CREDIT = 'ZERO_WITH_CREDIT', // 405
  EXPORT_GOODS = 'EXPORT_GOODS', // 407
  EXPORT_SERVICES = 'EXPORT_SERVICES', // 408
  NON_OBJECT_EXEMPT = 'NON_OBJECT_EXEMPT', // 431
  UNCLASSIFIED = 'UNCLASSIFIED',
}

export interface ClassificationDecision {
  invoiceId: string;
  category: IvaCategoryEnum;
  confidence?: number;
  reason: string;
  method: 'ATTRIBUTES' | 'RULE' | 'AI' | 'MANUAL';
}

// ============================================================================
// Economic Activity Fingerprint (ADR-006)
// ============================================================================

export interface ActivityFingerprint {
  activities: string[]; // List of activity codes
  hash: string; // SHA256 of sorted activities
}

// ============================================================================
// Results (ADR-015: no casillero, pure domain)
// ============================================================================

export interface ResultKey {
  key: string; // e.g., "PURCHASES_WITH_CREDIT"
  description: string;
  columnPart?: 'GROSS' | 'NET' | 'TAX'; // Which column if applicable
  operation: 'SALE' | 'PURCHASE' | 'FACTOR' | 'CREDIT';
  treatment?: string; // e.g., "with credit", "export services"
}

export const RESULT_KEYS = {
  SALES_TAXED: {
    key: 'SALES_TAXED',
    description: 'Taxed local sales (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'with IVA > 0',
  },
  SALES_ZERO_NO_CREDIT: {
    key: 'SALES_ZERO_NO_CREDIT',
    description: 'Local sales at 0% with no right to credit (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'zero no credit',
  },
  SALES_ZERO_WITH_CREDIT: {
    key: 'SALES_ZERO_WITH_CREDIT',
    description: 'Local sales at 0% with right to credit (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'zero with credit',
  },
  EXPORT_GOODS: {
    key: 'EXPORT_GOODS',
    description: 'Export of goods (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'export goods',
  },
  EXPORT_SERVICES: {
    key: 'EXPORT_SERVICES',
    description: 'Export of services (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'export services',
  },
  SALES_NON_OBJECT_EXEMPT: {
    key: 'SALES_NON_OBJECT_EXEMPT',
    description: 'Transfers not subject to or exempt from IVA (gross)',
    columnPart: 'GROSS' as const,
    operation: 'SALE' as const,
    treatment: 'non object or exempt',
  },
  PURCHASES_WITH_CREDIT: {
    key: 'PURCHASES_WITH_CREDIT',
    description: 'Purchases with right to tax credit (gross)',
    columnPart: 'GROSS' as const,
    operation: 'PURCHASE' as const,
    treatment: 'with credit',
  },
  PURCHASES_NO_CREDIT: {
    key: 'PURCHASES_NO_CREDIT',
    description: 'Purchases with no right to tax credit (gross)',
    columnPart: 'GROSS' as const,
    operation: 'PURCHASE' as const,
    treatment: 'no credit',
  },
  PURCHASES_ZERO_VAT: {
    key: 'PURCHASES_ZERO_VAT',
    description: 'Purchases with IVA = 0 (informational)',
    operation: 'PURCHASE' as const,
    treatment: 'zero vat',
  },
  PROPORTIONALITY_FACTOR: {
    key: 'PROPORTIONALITY_FACTOR',
    description: 'Proportionality factor (4 decimals)',
    operation: 'FACTOR' as const,
  },
  CREDIT_APPLICABLE: {
    key: 'CREDIT_APPLICABLE',
    description: 'Applicable tax credit',
    operation: 'CREDIT' as const,
  },
  VAT_NOT_CREDITED: {
    key: 'VAT_NOT_CREDITED',
    description: 'IVA not counted as credit due to the factor',
    operation: 'CREDIT' as const,
  },
} as const;

export type ResultKeyType = keyof typeof RESULT_KEYS;

export interface CalculationResult {
  key: ResultKeyType;
  value: Decimal;
  componentIds?: string[]; // Invoice IDs that make up this result
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Validation & Errors
// ============================================================================

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class AccessKeyInvalidError extends DomainError {
  constructor(accessKey: string, public reason: string) {
    super(
      `Access key validation failed: ${reason}`,
      'INVALID_ACCESS_KEY',
      { accessKey }
    );
  }
}
