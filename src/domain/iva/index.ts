/**
 * IVA domain layer (pure, no I/O).
 * Exports all domain services: parsing, validation, classification, calculation.
 */

// Access Key
export {
  parseAccessKey,
  calculateCheckDigit,
  verifyAccessKeyConsistency,
} from './access-key';
export type { DecomposedAccessKey } from './access-key';

// Proportionality
export {
  calculateProportionalityFactor,
  applyFactorToVat,
  calculateUncreditedVat,
} from './proportionality';
export type {
  SaleForFactor,
  ProportionalityCalculation,
} from './proportionality';

// Classification Cascade
export { classificationCascade, requiresManualReview } from './classification-cascade';
export type {
  ClassificationInput,
  ClassificationDecision,
  SupplierRule,
  CatalogEntry,
} from './classification-cascade';

// Calculator
export { calculatePeriodResults } from './calculator';
export type { ClassifiedInvoice, CalculationContext } from './calculator';

// Types
export {
  IvaCategoryEnum,
  SalesTreatmentEnum,
  RESULT_KEYS,
  DomainError,
  AccessKeyInvalidError,
} from '../types';
export type { ResultKey, CalculationResult } from '../types';
