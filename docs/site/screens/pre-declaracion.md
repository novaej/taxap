# Pre-declaración

**Ruta:** `/[taxpayerId]/periodos/[periodId]`
**Server Actions:** `computePeriodResults`, `lockPeriod`, `reopenPeriod`
**Capas:** `app/` → `services/declaration` → `domain/iva/form-104` (resultados) + `domain/iva/proportionality` → relación con `result_mappings` ([ADR-015](../../adr/015-definicion-del-formulario-desde-pdf.md)) → `lib/db`

---

## Acceso

Igual que [ingesta.md](ingesta.md). Es la pantalla de entrada al período — desde
aquí se navega a Ingesta, Ventas emitidas y Conciliación.

---

## Propósito

Mostrar, para cada resultado que el sistema calcula, **el valor y el casillero donde
se ingresa en el formulario del período**, con la explicación de por qué se ubicó
ahí y con trazabilidad hasta los comprobantes que lo componen. Es la pantalla que
materializa [ADR-014](../../adr/014-caracter-asistivo-y-disclaimers.md) y
[ADR-015](../../adr/015-definicion-del-formulario-desde-pdf.md).

**No presenta nada al SRI.** El usuario copia estos valores en el portal.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Agosto 2026 · Formulario 104 (mensual)          [ Borrador ]     │
├──────────────────────────────────────────────────────────────────┤
│  ⚠ Cálculo asistido, pendiente de revisión del responsable antes  │
│    de presentarse al SRI. No sustituye el criterio profesional.   │
│  ℹ Se trabaja con los totales de cada comprobante, no con el      │
│    detalle de líneas.                                              │
├──────────────────────────────────────────────────────────────────┤
│  1 archivo con incidencias · 2 ventas sin marcar destino          │
│  [ Ir a ingesta ]  [ Ir a ventas emitidas ]                       │
├──────────────────────────────────────────────────────────────────┤
│  VENTAS                                                            │
│  Ventas locales gravadas (bruto) — 401 = 0.00              [ver] │
│  Exportación de servicios (bruto) — 408 = 2,922.05          [ver] │
│    ¿Por qué 408? Ventas marcadas como exportación de servicios,   │
│    y el campo 408 del formulario se llama «Exportaciones de       │
│    servicios y/o derechos», columna valor bruto.                   │
│                                                                     │
│  ADQUISICIONES                                                     │
│  Con derecho a crédito tributario (bruto) — 500 = 0.00      [ver] │
│  Sin derecho a crédito tributario (bruto) — 502 = 162.87    [ver] │
│    ¿Por qué 502? Compras con IVA y sin derecho a crédito           │
│    tributario, y el campo 502 se llama «Otras adquisiciones y      │
│    pagos … (sin derecho a crédito tributario)», columna bruto.     │
│  Compras sin IVA (informativo) = 0.00                        [ver] │
│    Sin casillero definitivo — sugerido: 507 (aproximado)           │
│                                                                     │
│  FACTOR DE PROPORCIONALIDAD                                        │
│  ⚠ No calculado: hay 2 ventas con IVA 0% sin destino marcado.     │
│    [ Ir a marcar ]                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Formulario usado: 104 mensual, versión vigente desde 01/01/2024  │
│  [ Ver definición completa del formulario ]                        │
├──────────────────────────────────────────────────────────────────┤
│                                    [ Marcar período como declarado ]│
└──────────────────────────────────────────────────────────────────┘
```

---

## Composición de cada línea

Cada resultado (`domain/`, clave estable) se resuelve contra `result_mappings` de la
versión del formulario del período y se presenta como:

```
<nombre del campo> (<columna>) — <casillero> = <valor>
  ¿Por qué aquí? <razón guardada en la relación>
```

Un resultado sin relación conocida se muestra sin casillero, con el aviso "Sin
casillero definitivo" y, si existe, una sugerencia marcada como aproximada
([`../../tax/formulario-104.md`](../../tax/formulario-104.md) → *Sin casillero
definitivo*). Nunca se inventa un casillero sin decirlo.

### `[ver]` — trazabilidad

Abre el desglose: la lista de comprobantes que componen ese resultado, con
proveedor/cliente, fecha, monto. **La suma del desglose es exactamente el valor
mostrado** — misma lógica de dominio para ambos, nunca dos caminos que puedan
divergir.

### Factor de proporcionalidad

Si hay ventas con `IVA = 0` sin marcar, el factor **no se calcula** y se muestra el
motivo con enlace directo a [ventas-emitidas.md](ventas-emitidas.md)
([`../../tax/formulario-104.md`](../../tax/formulario-104.md) → *El factor de
proporcionalidad*). Cuando se calcula, se muestra con 4 decimales y su casillero
(563), junto con el crédito resultante (564).

---

## Cierre de período

"Marcar período como declarado" fija `locked_at`. A partir de ahí:

- Los comprobantes del período quedan protegidos por disparador
  ([ADR-013](../../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)); la pantalla
  pasa a modo lectura.
- Reabrir requiere una acción explícita separada ("Reabrir período"), con
  confirmación, y queda registrada como evento.

---

## Criterios de aceptación

- La suma del desglose de cualquier resultado es exactamente su valor mostrado.
- Con incidencias de ingesta o ventas sin marcar, la pantalla las señala arriba y
  enlaza a la pantalla que las resuelve, sin ocultar el resto de resultados ya
  disponibles.
- Un período `FILED` no permite ninguna acción de edición desde aquí ni desde
  Ingesta/Ventas/Conciliación.
- Cada resultado mostrado tiene su explicación visible sin pasos adicionales.
