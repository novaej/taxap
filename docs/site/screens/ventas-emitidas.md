# Ventas emitidas

**Ruta:** `/[taxpayerId]/periodos/[periodId]/ventas`
**Server Actions:** `markSalesTreatment` (individual y masivo)
**Capas:** `app/` → `services/declaration` → `domain/iva/proportionality` (bloqueo del factor) → `lib/db`

---

## Acceso

Igual que [ingesta.md](ingesta.md). Requiere que existan comprobantes emitidos
cargados para el período; si no hay ninguno, la pantalla muestra un estado vacío que
enlaza de vuelta a Ingesta.

---

## Propósito

El archivo de ventas emitidas no distingue por qué una venta tiene `IVA = 0`
(exportación de servicios, exportación de bienes, 0% con o sin derecho a crédito, no
objeto o exento) y tampoco trae al cliente ni el concepto
([`../../tax/formato-archivos-sri.md`](../../tax/formato-archivos-sri.md)). Esta
pantalla es donde el usuario resuelve esa ambigüedad, comprobante por comprobante o
en bloque. El factor de proporcionalidad depende directamente de esta clasificación
([`../../tax/formulario-104.md`](../../tax/formulario-104.md) → *El factor de
proporcionalidad*) y **no se calcula mientras quede algo sin marcar**.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Ventas emitidas · Agosto 2026                                    │
├──────────────────────────────────────────────────────────────────┤
│  Ventas gravadas (IVA > 0): 0 · asignadas automáticamente          │
│  Ventas con IVA 0%: 1 · faltan 1 por marcar                        │
├──────────────────────────────────────────────────────────────────┤
│  [ ] Seleccionar todo     Marcar seleccionadas como: [ ▾ elegir ]  │
├──────────────────────────────────────────────────────────────────┤
│ ☐│Serie          │Fecha     │Total   │Destino                 │  │
│ ☐│001-001-0000034│03/09/2026│2,500.00│ [ Exportación servicios▾]│  │
│  │                                    ⚠ sin marcar              │  │
├──────────────────────────────────────────────────────────────────┤
│  El factor de proporcionalidad no se calculará hasta que todas    │
│  las ventas con IVA 0% tengan un destino marcado.                 │
│                                                                     │
│  [ Continuar a conciliación de compras → ]                        │
└──────────────────────────────────────────────────────────────────┘
```

Las ventas con `IVA > 0` no aparecen en esta lista de pendientes — se muestran
aparte, ya asignadas, solo para que el usuario las vea.

---

## Destinos disponibles

Selector por fila y acción masiva, con las opciones de
[`../../tax/formulario-104.md`](../../tax/formulario-104.md) → *Ventas — desde
`invoices_issued`*:

| Opción visible | `sales_treatment` |
|---|---|
| Ventas locales 0% — no dan derecho a crédito | `ZERO_NO_CREDIT` |
| Ventas locales 0% — sí dan derecho a crédito | `ZERO_WITH_CREDIT` |
| Exportación de bienes | `EXPORT_GOODS` |
| Exportación de servicios | `EXPORT_SERVICES` |
| No objeto o exenta de IVA | `NON_OBJECT_EXEMPT` |

Cada opción muestra, en un texto de ayuda breve, si cuenta o no para el numerador del
factor de proporcionalidad — es la decisión que más le importa al usuario en esta
pantalla.

---

## Comportamiento

1. Al entrar, toda venta con `IVA = 0` sin destino se ve resaltada y cuenta en
   "faltan N por marcar".
2. Marcar una fila o una selección múltiple actualiza `sales_treatment` de inmediato
   (sin paso de confirmación aparte) y escribe un evento en `classification_events`
   con el usuario y la fecha ([ADR-013](../../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).
3. Remarcar una venta ya marcada es válido en cualquier momento antes del cierre del
   período, y también queda en la bitácora.
4. El botón "Continuar" no bloquea el avance — el usuario puede ir a conciliar
   compras sin haber terminado de marcar ventas — pero el resultado del factor en
   Pre-declaración mostrará el aviso de bloqueo mientras falte alguna.

---

## Criterios de aceptación

- Con una venta sin marcar, el factor de proporcionalidad no aparece calculado en
  Pre-declaración; aparece un mensaje explicando por qué.
- Cambiar el destino de una venta de "Exportación de servicios" a "0% sin derecho a
  crédito" cambia el factor la próxima vez que se recalcule, y el cambio queda en la
  bitácora con autor y fecha.
- Una venta con `IVA > 0` nunca aparece como pendiente de marcar.

---

## Fuera de esta pantalla

Las compras con `IVA = 0` no tienen una pantalla equivalente: no afectan al crédito
y se muestran como total informativo en Pre-declaración
([`../../tax/formulario-104.md`](../../tax/formulario-104.md) → *Sin casillero
definitivo*).
