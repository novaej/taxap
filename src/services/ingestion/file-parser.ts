/**
 * SRI file format parser (tab-separated text files).
 * Parses comprobantes recibidos (received) and emitidos (issued).
 *
 * Format verified against: docs/tax/formato-archivos-sri.md
 * Files come from SRI portal downloads, one file per day per type.
 */

import Decimal from 'decimal.js';

// ============================================================================
// Received Invoices (Compras) - 12 columns
// ============================================================================

export interface ReceivedInvoiceRow {
  RUC_EMISOR: string; // Emitter's RUC
  TIPO_COMPROBANTE: string; // 01-79 (whitelist in ADR-010)
  SERIE: string; // NNN-NNN-NNNNNNNNN
  NUMERO_COMPROBANTE: string; // 8 digits
  FECHA_EMISION: string; // DD/MM/YYYY
  CLAVE_ACCESO: string; // 49 digits
  VALOR_SIN_IMPUESTOS: Decimal;
  IVA: Decimal;
  DESCUENTO: Decimal;
  VALOR_TOTAL: Decimal;
  IDENTIFICACION_RECEPTOR: string; // Buyer's ID
  ESTADO: string; // "Autorizado", "No autorizado", etc.
}

export interface IssuedInvoiceRow {
  COMPROBANTE: string; // NNN-NNN-NNNNNNNNN
  FECHA_EMISION: string; // DD/MM/YYYY
  CLAVE_ACCESO: string; // 49 digits
  VALOR_SIN_IMPUESTOS: Decimal;
  IVA: Decimal;
  DESCUENTO: Decimal;
  VALOR_TOTAL: Decimal;
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
        TIPO_COMPROBANTE: columns[1].trim(),
        SERIE: columns[2].trim(),
        NUMERO_COMPROBANTE: columns[3].trim(),
        FECHA_EMISION: columns[4].trim(),
        CLAVE_ACCESO: columns[5].trim(),
        VALOR_SIN_IMPUESTOS: new Decimal(columns[6].trim()),
        IVA: new Decimal(columns[7].trim()),
        DESCUENTO: new Decimal(columns[8].trim()),
        VALOR_TOTAL: new Decimal(columns[9].trim()),
        IDENTIFICACION_RECEPTOR: columns[10].trim(),
        ESTADO: columns[11].trim(),
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
        FECHA_EMISION: columns[1].trim(),
        CLAVE_ACCESO: columns[2].trim(),
        VALOR_SIN_IMPUESTOS: new Decimal(columns[3].trim()),
        IVA: new Decimal(columns[4].trim()),
        DESCUENTO: new Decimal(columns[5].trim()),
        VALOR_TOTAL: new Decimal(columns[6].trim()),
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
