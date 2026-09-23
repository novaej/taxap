# Ingesta

**Ruta:** `/[taxpayerId]/periodos/[periodId]/ingesta`
**Server Actions:** `uploadSourceFiles`, `removeSourceFile`
**Capas:** `app/` → `services/ingestion` → `domain/iva` (validación de clave de acceso) → `lib/db` (bajo RLS)

---

## Acceso

Usuario autenticado con el contribuyente en `user_taxpayers`
([ADR-004](../../adr/004-rls-por-usuario-con-prisma.md)). El período no debe estar
`FILED` ([ADR-013](../../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)); si lo
está, la pantalla redirige a la vista de solo lectura del período.

---

## Propósito

Cargar los archivos `.txt` de comprobantes recibidos y emitidos del SRI para un
período, validarlos y dejarlos listos para clasificar. El SRI solo permite
descargar por día ([`../../tax/formato-archivos-sri.md`](../../tax/formato-archivos-sri.md)),
así que la pantalla está diseñada para **cargas repetidas y acumulativas**, no para
una carga única.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Contribuyente: PILLAJO COKA JONATHAN ANDRES · Agosto 2026        │
├──────────────────────────────────────────────────────────────────┤
│  ⚠ Aviso: los valores son un cálculo asistido, pendiente de       │
│    revisión por el responsable. (ADR-014)                         │
├──────────────────────────────────────────────────────────────────┤
│  [ Arrastre archivos .txt aquí o haga clic para seleccionar ]     │
│    Acepta varios archivos a la vez. Puede repetir esta carga      │
│    cuantas veces necesite — los archivos repetidos no duplican    │
│    nada.                                                           │
├──────────────────────────────────────────────────────────────────┤
│  Archivos de este período                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Archivo              │ Tipo      │ Filas │ Importadas │ ⚠  │  │
│  │ compras_01082026.txt │ Recibidos │   4   │     4      │ -  │  │
│  │ compras_02082026.txt │ Recibidos │   0   │     0      │ -  │  │ ← día sin movimiento
│  │ ventas_01082026.txt  │ Emitidos  │   1   │     1      │ -  │  │
│  │ compras_05082026.txt │ Recibidos │  12   │    10      │ 2  │  │ ← ver detalle
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  32 comprobantes de compra · 1 comprobante de venta cargados      │
│                                                                     │
│  [ Continuar a ventas emitidas → ]                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Comportamiento

### Carga

1. El usuario suelta o selecciona uno o varios `.txt`.
2. Por archivo: se calcula `sha256`; si coincide con uno ya cargado en este período,
   se informa y se omite sin error.
3. Se detecta el formato por las columnas del encabezado (recibidos: 12 columnas con
   `RUC_EMISOR`; emitidos: 8 columnas con `COMPROBANTE`, sin `TIPO_COMPROBANTE`
   — ver [`../../tax/formato-archivos-sri.md`](../../tax/formato-archivos-sri.md)).
   Un archivo que no calza con ninguno de los dos formatos se rechaza con el motivo.
4. Se registra en `source_files`.

### Validación por fila

Cada fila pasa por, en orden:

1. **Clave de acceso.** Se descompone y se contrasta contra fecha, tipo, RUC emisor
   (recibidos) o RUC dentro de la clave (emitidos) y serie
   ([ADR-009](../../adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)). Si no
   concuerda, la fila se rechaza y aparece en el detalle de incidencias.
2. **Pertenencia.** Recibidos: `IDENTIFICACION_RECEPTOR` debe ser el contribuyente
   del período. Emitidos: el RUC dentro de la clave de acceso debe serlo. **Si
   ninguna fila del archivo pertenece al contribuyente, se aborta la carga completa**
   del archivo con un mensaje explícito — el usuario probablemente subió el archivo
   de otro cliente.
3. **Fecha.** `FECHA_EMISION` debe caer dentro del período. Fuera de rango: la fila
   se rechaza y se muestra a qué período parece pertenecer, si se puede inferir.
4. **Tipo de comprobante** (solo recibidos). Contra la lista blanca
   ([ADR-010](../../adr/010-tratamiento-por-tipo-de-comprobante.md)). Un tipo no
   reconocido no se rechaza: se importa marcado para revisión manual.
5. **Inserción**, ignorando conflicto sobre `(taxpayer_id, access_key)`.

Un archivo con solo fila de encabezado (día sin movimiento) se acepta y muestra `0`
filas sin marcarse como error.

### Detalle de incidencias

La columna `⚠` es un contador clicable que abre las filas rechazadas de ese archivo,
cada una con el motivo exacto (clave inconsistente, fecha fuera de rango, formato de
número no reconocido). No hay corrección en línea en el MVP: el usuario corrige el
archivo de origen y lo vuelve a subir.

---

## Criterios de aceptación

- Cargar los mismos 30 archivos dos veces deja exactamente el mismo número de
  comprobantes que cargarlos una vez.
- Un archivo del contribuyente equivocado se rechaza por completo, con el RUC
  encontrado visible en el mensaje.
- Un archivo de un día sin movimiento no aparece como error.
- Reabrir la pantalla tras cerrar el navegador muestra los archivos ya cargados, no
  un estado en blanco.

---

## Fuera de esta pantalla

- La clasificación de compras (bandeja) — ver [conciliacion.md](conciliacion.md).
- El marcado de ventas con IVA 0 — ver [ventas-emitidas.md](ventas-emitidas.md).
- Notas de crédito y su neteo contra el comprobante original: se importan aquí, se
  procesan en el cálculo.
