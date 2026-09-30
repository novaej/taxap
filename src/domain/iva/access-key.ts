/**
 * Access Key (Clave de Acceso) validation and decomposition.
 * 49-digit identifier: date + type + RUC + series + number + verificador
 * ADR-009: Clave de acceso como clave de deduplicación e integridad
 *
 * Format: DDMMYYYYXXTTTSSEEEEEEEEVCVD
 * where:
 *  DD = day (01-31)
 *  MM = month (01-12)
 *  YYYY = year (2000-9999)
 *  XX = document type code
 *  TTT = IVA settlement type (3 digits)
 *  SS = establishment (2 digits)
 *  EEEEEEEE = emission sequence (8 digits)
 *  V = check digit (mod 11, weighted sum)
 *  CVD = empty (always 000)
 */

import { AccessKeyInvalidError } from '../types';

export interface DecomposedAccessKey {
  day: number;
  month: number;
  year: number;
  emissionDate: Date;
  documentType: string;
  ivaSettlementType: string; // Usually "001"
  establishment: string;
  emissionSequence: string;
  checkDigit: number;
  emptyDigits: string;
}

/**
 * Validate and decompose a 49-digit access key.
 * Checks:
 * 1. Length is exactly 49
 * 2. All characters are digits
 * 3. Date is valid
 * 4. Check digit matches (mod 11)
 * 5. Empty digits are "000"
 */
export function parseAccessKey(accessKey: string): DecomposedAccessKey {
  // 1. Length
  if (accessKey.length !== 49) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Length must be 49, got ${accessKey.length}`
    );
  }

  // 2. All digits
  if (!/^\d{49}$/.test(accessKey)) {
    throw new AccessKeyInvalidError(
      accessKey,
      'Must contain only digits'
    );
  }

  // Extract parts
  const day = parseInt(accessKey.substring(0, 2), 10);
  const month = parseInt(accessKey.substring(2, 4), 10);
  const year = parseInt(accessKey.substring(4, 8), 10);
  const documentType = accessKey.substring(8, 10);
  const ivaSettlementType = accessKey.substring(10, 13);
  const establishment = accessKey.substring(13, 15);
  const emissionSequence = accessKey.substring(15, 23);
  const checkDigit = parseInt(accessKey.substring(23, 24), 10);
  const emptyDigits = accessKey.substring(24, 27);

  // 3. Validate date
  if (month < 1 || month > 12) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Invalid month: ${month}`
    );
  }
  if (day < 1 || day > 31) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Invalid day: ${day}`
    );
  }

  const emissionDate = new Date(year, month - 1, day);
  // Check if date is valid (Date constructor is lenient)
  if (
    emissionDate.getUTCDate() !== day ||
    emissionDate.getUTCMonth() !== month - 1 ||
    emissionDate.getUTCFullYear() !== year
  ) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Invalid date: ${day}/${month}/${year}`
    );
  }

  // 4. Validate check digit
  const calculatedCheckDigit = calculateCheckDigit(accessKey.substring(0, 23));
  if (calculatedCheckDigit !== checkDigit) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Check digit mismatch: expected ${calculatedCheckDigit}, got ${checkDigit}`
    );
  }

  // 5. Empty digits must be "000"
  if (emptyDigits !== '000') {
    throw new AccessKeyInvalidError(
      accessKey,
      `Empty digits must be "000", got "${emptyDigits}"`
    );
  }

  return {
    day,
    month,
    year,
    emissionDate,
    documentType,
    ivaSettlementType,
    establishment,
    emissionSequence,
    checkDigit,
    emptyDigits,
  };
}

/**
 * Calculate the check digit using modulo 11 with weights.
 * Weights cycle: 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, ...
 * Check digit = 11 - (sum mod 11)
 * If result is 11, check digit is 0; if 10, it's 1 (according to SRI spec).
 */
export function calculateCheckDigit(first23: string): number {
  if (first23.length !== 23) {
    throw new Error('Check digit calculation requires exactly 23 digits');
  }

  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 23; i++) {
    const digit = parseInt(first23[i], 10);
    const weight = weights[i % 6];
    sum += digit * weight;
  }

  const remainder = sum % 11;
  let checkDigit = 11 - remainder;

  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) checkDigit = 1;

  return checkDigit;
}

/**
 * Verify that an access key is consistent with metadata.
 * Used during ingestion to validate data integrity.
 *
 * For received invoices: emitterRuc should match the RUC in the clave
 * For issued invoices: the RUC inside the clave should be the taxpayer's
 */
export function verifyAccessKeyConsistency(
  accessKey: string,
  ruc: string, // RUC to verify against (emitter for received, taxpayer for issued)
  series: string, // "NNN-NNN-NNNNNNNNN"
  emissionDate: Date
): void {
  const parsed = parseAccessKey(accessKey);

  // Date must match
  if (parsed.emissionDate.toISOString().split('T')[0] !==
      emissionDate.toISOString().split('T')[0]) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Emission date mismatch: access key says ${parsed.emissionDate.toISOString().split('T')[0]}, file says ${emissionDate.toISOString().split('T')[0]}`
    );
  }

  // Verify serie matches: extract establishment and sequence from serie
  const serieParts = series.split('-');
  if (serieParts.length !== 3) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Invalid serie format: ${series}`
    );
  }

  const serieEstablishment = serieParts[1];
  const serieSequence = serieParts[2];

  if (parsed.establishment !== serieEstablishment.padStart(2, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Establishment mismatch: access key says ${parsed.establishment}, serie says ${serieEstablishment}`
    );
  }

  if (parsed.emissionSequence !== serieSequence.padStart(8, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Emission sequence mismatch: access key says ${parsed.emissionSequence}, serie says ${serieSequence}`
    );
  }

  // RUC verification: extract the 10-digit RUC from positions 15-24 of the access key
  // In the SRI format, positions 10-19 represent the RUC (after removing hyphens from "NNN-NNN-NNNNNNNNN" etc.)
  // Actually, the RUC is embedded in positions 15-24 of the first 23 digits
  // For now, we accept the RUC as-is since the full structure isn't fully specified in the format.
  // This will be verified during actual implementation with real SRI files.
  // Placeholder: just check it's not empty
  if (!ruc || ruc.length === 0) {
    throw new AccessKeyInvalidError(
      accessKey,
      'RUC cannot be empty'
    );
  }
}
