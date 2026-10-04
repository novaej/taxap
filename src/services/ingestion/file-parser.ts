/**
 * SRI file format parser (tab-separated text files).
 * Parses received vouchers (comprobantes recibidos) and issued vouchers
 * (comprobantes emitidos).
 *
 * Format verified against real files: docs/tax/formato-archivos-sri.md
 * (2026-09-20). Do not add columns beyond what that document lists --
 * see CLAUDE.md -> "Verification before touching the SRI format".
 */

import Decimal from 'decimal.js';

// ============================================================================
// Received Invoices (Compras) - 12 columns
// ============================================================================

export interface ReceivedInvoiceRow {
  RUC_EMISOR: string;
  RAZON_SOCIAL_EMISOR: string; // main classification signal
  TIPO_COMPROBANTE: string; // whitelist, ADR-010
  SERIE_COMPROBANTE: string; // EEE-PPP-SSSSSSSSS
  CLAVE_ACCESO: string; // 49 digits
  FECHA_AUTORIZACION: string; // DD/MM/YYYY HH:MM:SS
  FECHA_EMISION: string; // DD/MM/YYYY -- determines the period, not the authorization date
  IDENTIFICACION_RECEPTOR: string; // 10 or 13 digits
  VALOR_SIN_IMPUESTOS: Decimal;
  IVA: Decimal; // 0 on vouchers with no IVA
  IMPORTE_TOTAL: Decimal;
  NUMERO_DOCUMENTO_MODIFICADO: string; // credit/debit notes only
}

// ============================================================================
// Issued Invoices (Ventas) - 8 columns. A different structure, not the same
// file with less data: it carries no issuer or receiver identification.
// ============================================================================

export interface IssuedInvoiceRow {
  COMPROBANTE: string; // note: not TIPO_COMPROBANTE
  SERIE_COMPROBANTE: string;
  CLAVE_ACCESO: string;
  FECHA_AUTORIZACION: string;
  FECHA_EMISION: string; // includes a time component in this file
  VALOR_SIN_IMPUESTOS: Decimal;
  IVA: Decimal;
  IMPORTE_TOTAL: Decimal;
}

export interface ParseResult<T> {
  rows: T[];
  errors: ParseError[];
  fileType: 'RECIBIDAS' | 'EMITIDAS';
}

export interface ParseError {
  lineNumber: number;
  row: string;
  reason: string;
}

/**
 * Detect file type by header columns.
 * Recibidas: 12 columns, has RUC_EMISOR
 * Emitidas: 8 columns, has COMPROBANTE, no TIPO_COMPROBANTE
 */
export function detectFileType(
  headerLine: string
): 'RECIBIDAS' | 'EMITIDAS' | null {
  const columns = headerLine.split('\t');

  if (columns.length === 12 && columns.includes('RUC_EMISOR')) {
    return 'RECIBIDAS';
  }
  if (columns.length === 8 && columns.includes('COMPROBANTE')) {
    return 'EMITIDAS';
  }

  return null;
}

/**
 * Parse received invoices (compras).
 * Skips header, parses each data row, returns rows + errors.
 */
export function parseReceivedFile(
  fileContent: string
): ParseResult<ReceivedInvoiceRow> {
  const lines = fileContent.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return { rows: [], errors: [], fileType: 'RECIBIDAS' };
  }

  const fileType = detectFileType(lines[0]);
  if (fileType !== 'RECIBIDAS') {
    return {
      rows: [],
      errors: [
        {
          lineNumber: 0,
          row: lines[0],
          reason: `Expected RECIBIDAS format (12 columns with RUC_EMISOR), got ${fileType || 'unknown'}`,
        },
      ],
      fileType: 'RECIBIDAS',
    };
  }

  const rows: ReceivedInvoiceRow[] = [];
  const errors: ParseError[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split('\t');

    if (columns.length !== 12) {
      errors.push({
        lineNumber: i + 1,
        row: line,
        reason: `Expected 12 columns, got ${columns.length}`,
      });
      continue;
    }

    try {
      const row: ReceivedInvoiceRow = {
        RUC_EMISOR: columns[0].trim(),
        RAZON_SOCIAL_EMISOR: columns[1].trim(),
        TIPO_COMPROBANTE: columns[2].trim(),
        SERIE_COMPROBANTE: columns[3].trim(),
        CLAVE_ACCESO: columns[4].trim(),
        FECHA_AUTORIZACION: columns[5].trim(),
        FECHA_EMISION: columns[6].trim(),
        IDENTIFICACION_RECEPTOR: columns[7].trim(),
        VALOR_SIN_IMPUESTOS: new Decimal(columns[8].trim()),
        IVA: new Decimal(columns[9].trim()),
        IMPORTE_TOTAL: new Decimal(columns[10].trim()),
        NUMERO_DOCUMENTO_MODIFICADO: columns[11].trim(),
      };

      rows.push(row);
    } catch (err) {
      errors.push({
        lineNumber: i + 1,
        row: line,
        reason: err instanceof Error ? err.message : 'Parsing error',
      });
    }
  }

  return { rows, errors, fileType: 'RECIBIDAS' };
}

/**
 * Parse issued invoices (ventas).
 * Skips header, parses each data row, returns rows + errors.
 */
export function parseIssuedFile(
  fileContent: string
): ParseResult<IssuedInvoiceRow> {
  const lines = fileContent.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return { rows: [], errors: [], fileType: 'EMITIDAS' };
  }

  const fileType = detectFileType(lines[0]);
  if (fileType !== 'EMITIDAS') {
    return {
      rows: [],
      errors: [
        {
          lineNumber: 0,
          row: lines[0],
          reason: `Expected EMITIDAS format (8 columns with COMPROBANTE), got ${fileType || 'unknown'}`,
        },
      ],
      fileType: 'EMITIDAS',
    };
  }

  const rows: IssuedInvoiceRow[] = [];
  const errors: ParseError[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split('\t');

    if (columns.length !== 8) {
      errors.push({
        lineNumber: i + 1,
        row: line,
        reason: `Expected 8 columns, got ${columns.length}`,
      });
      continue;
    }

    try {
      const row: IssuedInvoiceRow = {
        COMPROBANTE: columns[0].trim(),
        SERIE_COMPROBANTE: columns[1].trim(),
        CLAVE_ACCESO: columns[2].trim(),
        FECHA_AUTORIZACION: columns[3].trim(),
        FECHA_EMISION: columns[4].trim(),
        VALOR_SIN_IMPUESTOS: new Decimal(columns[5].trim()),
        IVA: new Decimal(columns[6].trim()),
        IMPORTE_TOTAL: new Decimal(columns[7].trim()),
      };

      rows.push(row);
    } catch (err) {
      errors.push({
        lineNumber: i + 1,
        row: line,
        reason: err instanceof Error ? err.message : 'Parsing error',
      });
    }
  }

  return { rows, errors, fileType: 'EMITIDAS' };
}

/**
 * Auto-detect file type and parse accordingly.
 */
export function parseFile(
  fileContent: string
): ParseResult<ReceivedInvoiceRow | IssuedInvoiceRow> {
  const lines = fileContent.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return {
      rows: [],
      errors: [{ lineNumber: 0, row: '', reason: 'Empty file' }],
      fileType: 'RECIBIDAS', // Default
    };
  }

  const fileType = detectFileType(lines[0]);

  if (fileType === 'RECIBIDAS') {
    return parseReceivedFile(fileContent);
  }
  if (fileType === 'EMITIDAS') {
    return parseIssuedFile(fileContent);
  }

  return {
    rows: [],
    errors: [
      {
        lineNumber: 0,
        row: lines[0],
        reason: 'Unknown file format (not RECIBIDAS or EMITIDAS)',
      },
    ],
    fileType: 'RECIBIDAS', // Default
  };
}
