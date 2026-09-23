# Conciliación

**Ruta:** `/[taxpayerId]/periodos/[periodId]/conciliacion`
**Server Actions:** `classifyPeriod` (dispara la cascada), `applyManualClassification` (individual y masivo)
**Capas:** `app/` → `services/classification` → `domain/iva/classification-rules` → `lib/ai` (nivel 3, opcional) → `lib/db`

---

## Acceso

Igual que [ingesta.md](ingesta.md). Requiere comprobantes recibidos cargados.

---

## Propósito

Bandeja donde el usuario resuelve lo que la cascada de clasificación no pudo decidir
solo, y desde donde se dispara la clasificación en sí
([ADR-005](../../adr/005-clasificacion-en-cascada.md),
[ADR-011](../../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)). Cada decisión
manual se convierte en una regla que cubre a este proveedor en períodos futuros
([ADR-006](../../adr/006-reglas-por-proveedor-y-actividad-economica.md)).

Solo entran aquí comprobantes con `IVA > 0`
([ADR-008](../../adr/008-solo-totales-sin-detalle-de-lineas.md)).

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Conciliación de compras · Agosto 2026                            │
│                                                                     │
│  [ ▶ Clasificar comprobantes pendientes ]  (dispara la cascada)   │
├──────────────────────────────────────────────────────────────────┤
│  ( Con crédito tributario 18 )  ( Costo o gasto 40 )  ( Pendientes 2 ● )│
├──────────────────────────────────────────────────────────────────┤
│  Pestaña activa: Pendientes de revisión                           │
│                                                                     │
│  [ ] Seleccionar todo    Acción masiva: [ ▾ Con crédito / Costo /  │
│                                             Excluir ]               │
├──────────────────────────────────────────────────────────────────┤
│ ☐│Proveedor           │RUC          │Total │Motivo                │
│ ☐│SERVICIOS NUBE CIA  │179XXXXXXX001│450.00│IA: confianza 0.62    │
│  │                    │             │      │(menor al umbral)     │
│ ☐│COMERCIAL XYZ S.A.  │179XXXXXXX001│ 89.50│Tipo de comprobante   │
│  │                    │             │      │no reconocido: "N/D"  │
├──────────────────────────────────────────────────────────────────┤
└──────────────────────────────────────────────────────────────────┘
```

Las otras dos pestañas ("Con crédito tributario", "Costo o gasto") muestran la misma
tabla filtrada por `iva_category`, con la misma acción masiva disponible para
reclasificar.

---

## Comportamiento

### Disparar la clasificación

El botón ejecuta el paso 2 ([ADR-011](../../adr/011-ingesta-y-clasificacion-en-dos-pasos.md)):
agrupa los comprobantes sin clasificar por proveedor y corre la cascada. Es
**reanudable** — si se interrumpe, volver a pulsarlo continúa donde quedó, sin
reconsultar proveedores ya resueltos. Mientras corre, se muestra progreso
("Clasificando 40 de 62 proveedores…"); al terminar, las pestañas se actualizan.

### Bandeja de pendientes

Cada fila muestra el **motivo** por el que no se resolvió sola:

| Motivo | Origen |
|---|---|
| Confianza de la IA por debajo del umbral | Nivel 3 |
| Tipo de comprobante no reconocido | Validación de ingesta ([ADR-010](../../adr/010-tratamiento-por-tipo-de-comprobante.md)) |
| Regla del proveedor pendiente de revalidación | Cambio de actividad económica ([ADR-006](../../adr/006-reglas-por-proveedor-y-actividad-economica.md)) |
| Sin coincidencia en ningún nivel | Cascada agotada |

### Clasificar manualmente

Seleccionar una o varias filas y elegir "Con crédito", "Costo o gasto" o "Excluir":

1. Actualiza `iva_category` de los comprobantes seleccionados.
2. Escribe un evento por comprobante en `classification_events`
   ([ADR-013](../../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).
3. **Crea o actualiza la regla del proveedor** para este contribuyente y su huella de
   actividad económica actual — así el mismo proveedor se resuelve solo la próxima
   vez ([ADR-006](../../adr/006-reglas-por-proveedor-y-actividad-economica.md)).

"Excluir" saca el comprobante del cálculo sin borrarlo; queda visible con estado
`EXCLUDED` y motivo, por si el usuario necesita revisarlo después.

### Reglas pendientes de revalidación

Si las actividades económicas del contribuyente cambiaron desde que se creó una
regla, los comprobantes de ese proveedor vuelven a la bandeja con el motivo "Regla
pendiente de revalidación", en vez de aplicar en silencio un criterio que puede
haber quedado obsoleto. Confirmar en bloque reemite la regla con la huella actual.

---

## Criterios de aceptación

- Al reclasificar manualmente un proveedor, el siguiente período lo clasifica solo,
  sin pasar por la IA.
- Volver a pulsar "Clasificar" tras una interrupción no duplica consultas a la IA
  para proveedores ya resueltos.
- Un comprobante `EXCLUDED` no aparece en ningún total de Pre-declaración, pero sigue
  siendo consultable.

---

## Fuera de esta pantalla

El modo sin IA ([ADR-007](../../adr/007-modo-sin-ia-y-catalogo-compartido.md)) no
cambia esta pantalla: solo cambia cuánto llega a la bandeja. No hay un interruptor
aquí; se configura a nivel de cuenta.
