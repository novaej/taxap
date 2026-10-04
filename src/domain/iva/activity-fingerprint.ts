/**
 * Huella de actividad económica (ADR-006): hash del conjunto de
 * actividades de un contribuyente, usado como parte de la clave de
 * supplier_rules. Se recalcula al editar las actividades; cuando cambia,
 * las reglas emitidas bajo el valor anterior quedan pendientes de
 * revalidación.
 *
 * Puro: sin I/O, no importa infraestructura (ADR-001). El orden de entrada
 * no debe afectar el resultado -- se ordena antes de hashear.
 */

import { createHash } from 'crypto';

export function computeActivityFingerprint(activityCodes: string[]): string {
  const sorted = [...activityCodes].sort();
  return createHash('sha256').update(sorted.join(',')).digest('hex');
}
