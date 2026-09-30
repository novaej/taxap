/**
 * Ingestion service - Step 1 of 2 (ADR-011).
 * Exports: file parser, validation service.
 */

export { parseFile, parseReceivedFile, parseIssuedFile, detectFileType } from './file-parser';
export type { ReceivedInvoiceRow, IssuedInvoiceRow, ParseResult, ParseError } from './file-parser';

export { ingestionService, IngestionService, VOUCHER_TYPE_WHITELIST } from './ingestion-service';
export type { InvoiceValidationResult, ValidationError, IngestionReport } from './ingestion-service';
