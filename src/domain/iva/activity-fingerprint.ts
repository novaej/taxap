/**
 * Economic activity fingerprint (ADR-006): hash of a taxpayer's set of
 * activities, used as part of the supplier_rules key. Recomputed when the
 * activities are edited; when it changes, rules issued under the
 * previous value are left pending revalidation.
 *
 * Pure: no I/O, no infrastructure import (ADR-001). Input order must not
 * affect the result -- it's sorted before hashing.
 */

import { createHash } from 'crypto';

export function computeActivityFingerprint(activityCodes: string[]): string {
  const sorted = [...activityCodes].sort();
  return createHash('sha256').update(sorted.join(',')).digest('hex');
}
