# Ciclo de vida de un período

Recorrido completo desde que el usuario descarga los archivos hasta que obtiene
el borrador. Para el detalle de cada decisión, los ADRs enlazados.

---

## 1. El usuario descarga del SRI

Fuera del sistema. El portal del SRI solo permite consultar **por día**, así que un
período mensual puede requerir 31 archivos por tipo.

Producto: archivos `.txt` separados por tabulación, en dos formatos distintos
(recibidos y emitidos). Ver
[`../tax/formato-archivos-sri.md`](../tax/formato-archivos-sri.md).

## 2. Carga

`app/[locale]/(app)/[taxpayerId]/ingesta` → Server Action → `services/ingestion`

La pantalla acepta **varios archivos a la vez** y permite agregar más a un período
ya iniciado.

Por archivo:
1. Calcular `sha256`. Si ya fue cargado idéntico, se avisa y se omite.
2. Detectar el formato por las columnas del encabezado.
3. Registrar en `source_files`.

Por fila:
1. Descomponer la `CLAVE_ACCESO` y contrastarla con fecha, tipo, RUC y serie.
   Si no concuerda, se rechaza y se reporta.
2. Verificar que el comprobante pertenece al contribuyente seleccionado
   (compras: `IDENTIFICACION_RECEPTOR`; ventas: el RUC dentro de la clave).
   **Si no coincide, se aborta la carga completa** — el usuario subió el archivo de
   otro cliente.
3. Verificar que `FECHA_EMISION` cae dentro del período.
4. Verificar el tipo contra la lista blanca
   ([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)).
   Tipo desconocido → bandeja, nunca descarte silencioso.
5. Insertar ignorando conflictos sobre `(taxpayer_id, access_key)`.

Los archivos solo con encabezado (días sin movimiento) se aceptan sin error.

**Al terminar, los comprobantes están guardados sin clasificar.** Si algo falla
después, nada se pierde. ([ADR-011](../adr/011-ingesta-y-clasificacion-en-dos-pasos.md))

## 3. Clasificación

Paso separado, disparado por el usuario y **reanudable**: volver a ejecutarlo
continúa donde quedó.

Solo entran los comprobantes con `IVA > 0`. Los de `IVA = 0` se marcan
`NOT_APPLICABLE` y salen de la cascada
([ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md)).

Se agrupan **por proveedor**, no por comprobante:

```
┌─ Nivel 1 ── supplier_rules (contribuyente, proveedor, huella de actividad)
│             ↓ sin coincidencia
├─ Nivel 2 ── shared_supplier_catalog, si supera el umbral de acuerdo
│             ↓ sin coincidencia
├─ Nivel 3 ── IA, si ai_enabled. Salida estructurada, por proveedor
│             ↓ confianza por debajo del umbral
└─ Nivel 4 ── bandeja de revisión manual
```

El veredicto del grupo se aplica a todos los comprobantes de ese proveedor. Cada
uno recibe un evento en `classification_events`.

## 4. Conciliación

`app/[locale]/(app)/[taxpayerId]/conciliacion`

Tres estados, con acciones masivas: con crédito, como costo o gasto, y pendientes.

Cada decisión del usuario:
1. Actualiza el comprobante.
2. Escribe un evento en la bitácora, con autor.
3. **Crea o actualiza la regla de nivel 1.**

El tercer punto es el ciclo de retroalimentación: lo corregido hoy se aplica solo
el mes que viene ([ADR-005](../adr/005-clasificacion-en-cascada.md)).

## 5. Factor de proporcionalidad

`services/declaration` → `domain/iva/proportionality`

Se calcula de la composición de las **ventas** del período. Los insumos se guardan
en `tax_periods.factor_inputs` para que el número sea verificable.

El dominio calcula el factor con su propia lógica. Exportaciones y ventas 0% con
derecho a crédito cuentan como ventas que dan derecho a crédito; las 0% sin derecho
y las no objeto o exentas, no. Un contribuyente que solo exporta servicios tiene
factor `1.0000` ([`../tax/formulario-104.md`](../tax/formulario-104.md)).

El archivo de emitidos no dice a qué destino corresponde una venta con `IVA = 0`.
**Tras la carga, el usuario ve una tabla de sus ventas y marca cada una** (o varias
a la vez). Las de `IVA > 0` se asignan solas. **El factor no se calcula mientras
haya ventas sin marcar.** Cada marca escribe un evento en la bitácora.

El sistema explica en texto qué factor obtuvo y por qué.

## 6. Pre-declaración

El dominio produce **resultados con clave estable** (`SALES_TAXED`,
`PURCHASES_WITH_CREDIT`, …) y no conoce números de casillero. Se guardan en
`period_results`.

La presentación relaciona cada resultado con un campo del catálogo de la versión del
formulario del período ([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).
La relación se resuelve en cascada (guardada → coincidencia por atributos → IA opcional
→ sin casillero), se guarda por versión en `result_mappings`, y se muestra:

```
Adquisiciones con derecho a crédito tributario (valor bruto) — 500 = 1,000.00
```

**El formulario es el destino: el usuario copia estos valores en el portal del SRI.**
El período guarda el `form_version_id` con el que se presentó el resultado.

Cada relación lleva su **explicación** (por qué se ubicó en ese casillero), visible para
el usuario; es una aproximación y se presenta como tal. Nadie la corrige a mano.

Cada resultado se puede abrir y muestra los comprobantes que lo componen. **La suma del
desglose es exactamente el valor del resultado.** Un resultado sin casillero (compras
con `IVA = 0`) se muestra sin código.

Aviso permanente sobre el carácter asistivo del cálculo y el uso de totales
([ADR-014](../adr/014-caracter-asistivo-y-disclaimers.md)).

## 7. Cierre

El usuario marca el período como declarado. Se fija `locked_at` y un disparador
rechaza toda modificación posterior de sus comprobantes.

Corregir exige reabrir el período explícitamente, y esa reapertura queda registrada
([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).
