/**
 * Invoice ingestion service.
 * Step 1 of 2 (ADR-011): Parse, validate, and import invoices.
 *
 * Validation pipeline:
 * 1. Access key format and check digit
 * 2. Access key consistency (date, serie, RUC)
 * 3. Belongingness to taxpayer
 * 4. Date falls within tax period
 * 5. Voucher type whitelisted (ADR-010)
 * 6. Deduplication by access key
 */

import Decimal from 'decimal.js';
import { ReceivedInvoiceRow, IssuedInvoiceRow } from './file-parser';
import {
  parseAccessKey,
  verifyAccessKeyConsistency,
  AccessKeyInvalidError,
} from '@/domain/iva/access-key';
import { DomainError } from '@/domain/types';

// ============================================================================
// Validation Results
// ============================================================================

export interface InvoiceValidationResult {
  invoiceId?: string; // If validated and upserted
  accessKey: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string; // e.g., "INVALID_ACCESS_KEY", "OUT_OF_PERIOD", "DUPLICATE"
}

export interface IngestionReport {
  filename: string;
  fileType: 'RECIBIDAS' | 'EMITIDAS';
  totalRows: number;
  importedCount: number;
  validCount: number;
  errorCount: number;
  results: InvoiceValidationResult[];
}

// ============================================================================
// Voucher Type Whitelist (ADR-010)
// ============================================================================

const VOUCHER_TYPE_WHITELIST = new Set([
  '01', // Factura
  '02', // Nota de venta
  '03', // Liquidación de compra
  '04', // Nota de crédito
  '05', // Nota de débito
  '06', // Guía de remisión
  '07', // Comprobante de retención
  '08', // Comprobante de percepción
  '09', // Retención (in-house)
  '20', // Factura (domiciliada)
  '21', // Nota de venta (domiciliada)
  // ... others (01-79 per SRI)
]);

// ============================================================================
// Validation Service
// ============================================================================

export class IngestionService {
  /**
   * Validate a received invoice row.
   * Returns all errors found; the row is invalid if any error exists.
   */
  validateReceivedRow(
    row: ReceivedInvoiceRow,
    taxpayerRuc: string,
    periodStart: Date,
    periodEnd: Date,
    existingAccessKeys: Set<string> // For deduplication
  ): InvoiceValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const accessKey = row.CLAVE_ACCESO;

    // 1. Access key format and check digit
    try {
      parseAccessKey(accessKey);
    } catch (err) {
      if (err instanceof AccessKeyInvalidError) {
        errors.push({
          field: 'CLAVE_ACCESO',
          message: err.reason,
          code: 'INVALID_ACCESS_KEY',
        });
      } else {
        errors.push({
          field: 'CLAVE_ACCESO',
          message: 'Access key validation failed',
          code: 'INVALID_ACCESS_KEY',
        });
      }
    }

    // 2. Access key consistency
    if (errors.length === 0) {
      try {
        verifyAccessKeyConsistency(
          accessKey,
          row.RUC_EMISOR,
          row.SERIE,
          this.parseDate(row.FECHA_EMISION)
        );
      } catch (err) {
        if (err instanceof AccessKeyInvalidError) {
          errors.push({
            field: 'CLAVE_ACCESO',
            message: err.reason,
            code: 'ACCESS_KEY_MISMATCH',
          });
        }
      }
    }

    // 3. Belongingness to taxpayer
    if (row.IDENTIFICACION_RECEPTOR !== taxpayerRuc) {
      errors.push({
        field: 'IDENTIFICACION_RECEPTOR',
        message: `Receiver RUC ${row.IDENTIFICACION_RECEPTOR} does not match taxpayer ${taxpayerRuc}`,
        code: 'WRONG_TAXPAYER',
      });
    }

    // 4. Date within period
    const emissionDate = this.parseDate(row.FECHA_EMISION);
    if (emissionDate < periodStart || emissionDate > periodEnd) {
      errors.push({
        field: 'FECHA_EMISION',
        message: `Date ${row.FECHA_EMISION} is outside period [${periodStart.toISOString()}, ${periodEnd.toISOString()}]`,
        code: 'OUT_OF_PERIOD',
      });
    }

    // 5. Voucher type whitelisted
    if (!VOUCHER_TYPE_WHITELIST.has(row.TIPO_COMPROBANTE)) {
      warnings.push(
        `Voucher type ${row.TIPO_COMPROBANTE} not in whitelist; will be marked for manual review`
      );
    }

    // 6. Deduplication
    if (existingAccessKeys.has(accessKey)) {
      errors.push({
        field: 'CLAVE_ACCESO',
        message: `Access key already imported in this period`,
        code: 'DUPLICATE',
      });
    }

    return {
      accessKey,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate an issued invoice row.
   */
  validateIssuedRow(
    row: IssuedInvoiceRow,
    periodStart: Date,
    periodEnd: Date,
    existingAccessKeys: Set<string>
  ): InvoiceValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const accessKey = row.CLAVE_ACCESO;

    // 1. Access key format and check digit
    try {
      parseAccessKey(accessKey);
    } catch (err) {
      if (err instanceof AccessKeyInvalidError) {
        errors.push({
          field: 'CLAVE_ACCESO',
          message: err.reason,
          code: 'INVALID_ACCESS_KEY',
        });
      }
    }

    // 2. Access key consistency (serie extracted from COMPROBANTE)
    if (errors.length === 0) {
      try {
        verifyAccessKeyConsistency(
          accessKey,
          '', // RUC is embedded in the access key for issued invoices
          row.COMPROBANTE,
          this.parseDate(row.FECHA_EMISION)
        );
      } catch (err) {
        if (err instanceof AccessKeyInvalidError) {
          errors.push({
            field: 'CLAVE_ACCESO',
            message: err.reason,
            code: 'ACCESS_KEY_MISMATCH',
          });
        }
      }
    }

    // 3. Date within period
    const emissionDate = this.parseDate(row.FECHA_EMISION);
    if (emissionDate < periodStart || emissionDate > periodEnd) {
      errors.push({
        field: 'FECHA_EMISION',
        message: `Date ${row.FECHA_EMISION} is outside period`,
        code: 'OUT_OF_PERIOD',
      });
    }

    // 4. Deduplication
    if (existingAccessKeys.has(accessKey)) {
      errors.push({
        field: 'CLAVE_ACCESO',
        message: `Access key already imported in this period`,
        code: 'DUPLICATE',
      });
    }

    return {
      accessKey,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse DD/MM/YYYY to Date.
   */
  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
}

export const ingestionService = new IngestionService();
