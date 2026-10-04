/**
 * Access Key (Clave de Acceso) validation and decomposition.
 * 49 digits. Verified against real access keys in
 * docs/tax/formato-archivos-sri.md -> "The access key" (2026-09-20).
 * ADR-009: Access key as the deduplication and integrity key
 *
 * Position | Length | Field
 *    0–7   |   8    | Emission date DDMMYYYY
 *    8–9   |   2    | Voucher type
 *   10–22  |   13   | Issuer's RUC
 *    23    |   1    | Environment (1 test, 2 production)
 *   24–26  |   3    | Establishment
 *   27–29  |   3    | Emission point
 *   30–38  |   9    | Sequential number
 *   39–46  |   8    | Numeric code
 *    47    |   1    | Emission type
 *    48    |   1    | Check digit
 */

import { AccessKeyInvalidError } from '../types';

export interface DecomposedAccessKey {
  day: number;
  month: number;
  year: number;
  emissionDate: Date;
  documentType: string;
  rucEmisor: string;
  environment: string;
  establishment: string;
  emissionPoint: string;
  emissionSequence: string;
  numericCode: string;
  emissionType: string;
  checkDigit: number;
}

/**
 * Validate and decompose a 49-digit access key.
 * Checks:
 * 1. Length is exactly 49
 * 2. All characters are digits
 * 3. Date is valid
 * 4. Check digit matches (mod 11 over the first 48 digits)
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
  const rucEmisor = accessKey.substring(10, 23);
  const environment = accessKey.substring(23, 24);
  const establishment = accessKey.substring(24, 27);
  const emissionPoint = accessKey.substring(27, 30);
  const emissionSequence = accessKey.substring(30, 39);
  const numericCode = accessKey.substring(39, 47);
  const emissionType = accessKey.substring(47, 48);
  const checkDigit = parseInt(accessKey.substring(48, 49), 10);

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

  // 4. Validate check digit (mod 11 over the first 48 digits)
  const calculatedCheckDigit = calculateCheckDigit(accessKey.substring(0, 48));
  if (calculatedCheckDigit !== checkDigit) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Check digit mismatch: expected ${calculatedCheckDigit}, got ${checkDigit}`
    );
  }

  return {
    day,
    month,
    year,
    emissionDate,
    documentType,
    rucEmisor,
    environment,
    establishment,
    emissionPoint,
    emissionSequence,
    numericCode,
    emissionType,
    checkDigit,
  };
}

/**
 * Calculate the check digit using modulo 11 with weights.
 * Weights cycle left to right: 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, ...
 * Check digit = 11 - (sum mod 11)
 * If result is 11, check digit is 0; if 10, it's 1.
 *
 * Verified against both real access keys in
 * docs/tax/formato-archivos-sri.md (check digits 4 and 5, both correct
 * with this weighting over the first 48 digits).
 */
export function calculateCheckDigit(first48: string): number {
  if (first48.length !== 48) {
    throw new Error('Check digit calculation requires exactly 48 digits');
  }

  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 48; i++) {
    const digit = parseInt(first48[i], 10);
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
 * Verify that an access key is consistent with metadata from the file row.
 *
 * For received invoices: `ruc` is the supplier's RUC (RUC_EMISOR) -- the
 * access key's embedded RUC belongs to whoever issued the invoice.
 * For issued invoices: `ruc` is the taxpayer's own RUC -- the access key's
 * embedded RUC is the taxpayer's, because they're the issuer.
 */
export function verifyAccessKeyConsistency(
  accessKey: string,
  ruc: string,
  series: string, // "EEE-PPP-SSSSSSSSS"
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

  // RUC embedded in the access key must match
  if (!ruc || ruc.length === 0) {
    throw new AccessKeyInvalidError(accessKey, 'RUC cannot be empty');
  }
  if (parsed.rucEmisor !== ruc.padStart(13, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `RUC mismatch: access key says ${parsed.rucEmisor}, expected ${ruc}`
    );
  }

  // Serie: "EEE-PPP-SSSSSSSSS" -> establishment + emission point + sequential number
  const serieParts = series.split('-');
  if (serieParts.length !== 3) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Invalid serie format: ${series}`
    );
  }

  const [serieEstablishment, serieEmissionPoint, serieSequence] = serieParts;

  if (parsed.establishment !== serieEstablishment.padStart(3, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Establishment mismatch: access key says ${parsed.establishment}, serie says ${serieEstablishment}`
    );
  }

  if (parsed.emissionPoint !== serieEmissionPoint.padStart(3, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Emission point mismatch: access key says ${parsed.emissionPoint}, serie says ${serieEmissionPoint}`
    );
  }

  if (parsed.emissionSequence !== serieSequence.padStart(9, '0')) {
    throw new AccessKeyInvalidError(
      accessKey,
      `Emission sequence mismatch: access key says ${parsed.emissionSequence}, serie says ${serieSequence}`
    );
  }
}
