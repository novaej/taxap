# ADR-008: Solo totales, sin detalle de líneas

> **Actualización (2026-09-20):** la regla "`IVA = 0` no entra a la cascada" es
> correcta para **compras**, donde un comprobante sin IVA no genera crédito. **No
> aplica sin más a ventas**: el formulario reparte las ventas con `IVA = 0` entre
> destinos que sí cambian el factor de proporcionalidad (exportaciones, ventas 0% con
> derecho a crédito…), y el archivo de emitidos no indica cuál corresponde. Por eso el
> usuario marca el destino de cada venta con `IVA = 0` en una tabla tras la carga. Ver
> [`docs/tax/formulario-104.md`](../tax/formulario-104.md) → *Decisiones tomadas*.
> El resto del ADR no cambia.

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Los archivos de comprobantes del SRI traen **un total por comprobante**, no el
detalle de líneas. Las columnas útiles para IVA son:

```
VALOR_SIN_IMPUESTOS    IVA    IMPORTE_TOTAL
```

Esto tiene una consecuencia incómoda: una factura **mixta** —con productos gravados
y productos con tarifa 0%— llega como un solo par de números.

```
VALOR_SIN_IMPUESTOS = 100.00
IVA                 =   4.50    → solo 30.00 estuvo gravado al 15%
```

Se consideró derivar la base gravada como `IVA / tasa` y el resto como base 0%.
La aritmética es trivial, pero introduce un número que la fuente no contiene, con
sus propias tolerancias de redondeo y sus propios fallos de conciliación.

También se consideró qué hacer con `IVA = 0`. Ese caso es ambiguo en la fuente:
no se distingue tarifa 0%, exento y no objeto de IVA.

## Decisión

**Se almacena lo que el archivo trae, y nada más.** `subtotal` y `vat_amount` son
copias fieles de `VALOR_SIN_IMPUESTOS` e `IVA`. No hay columnas derivadas.

**La clasificación opera sobre el comprobante completo**, no sobre partes de él.
Una factura mixta recibe un solo tratamiento, determinado por el proveedor y la
actividad económica del contribuyente
([ADR-006](006-reglas-por-proveedor-y-actividad-economica.md)).

**Los comprobantes con `IVA = 0` no entran a la cascada de clasificación.** Sin
IVA no hay crédito tributario posible, no hay categoría de crédito que decidir y no hay
factor que aplicar. Van a un bucket agregado (`iva_category = NOT_APPLICABLE`) y
su total se reporta sin decisión por comprobante. **No hace falta saber por qué el
IVA es cero.**

**La limitación se declara en la interfaz**, no se esconde:

> Los cálculos se basan en los totales de cada comprobante. Los archivos del SRI no
> incluyen el detalle de líneas, por lo que una factura con productos gravados y no
> gravados recibe un solo tratamiento. Si necesita desagregarla, revise el
> comprobante original.

## Consecuencias

### Positivas
- El modelo de datos refleja la fuente sin inventar nada. Cualquier valor mostrado
  se puede rastrear a una columna de un archivo.
- Menos superficie de error: sin derivaciones no hay conciliaciones que fallen ni
  incidencias de redondeo que inunden la bandeja.
- La clasificación se simplifica: una decisión por comprobante.
- El volumen que pasa por la cascada se reduce, porque los `IVA = 0` no entran.

### Negativas
- **Una factura mixta se reporta entera en un solo casillero de base imponible.**
  Es incorrecto en el detalle, aunque el crédito tributario —que es el IVA, y ese
  sí es exacto— quede bien. El aviso en la interfaz es la mitigación, no la
  solución.
- El bucket de `IVA = 0` no se puede desagregar entre 0%, exento y no objeto. Si el
  formulario los distingue, el usuario debe ajustar manualmente.
- Si más adelante se ingesta el XML del comprobante —que sí trae líneas—, convivirán
  dos niveles de precisión según el origen del dato. Se resuelve con
  `source_files.kind`, pero hay que preverlo al diseñar los reportes.

## Alternativas consideradas

**Derivar `base_gravada = IVA / tasa`.** Permitiría separar correctamente las
facturas mixtas. Descartada para el MVP: agrega un valor inventado, con tolerancias
y fallos propios, para corregir un caso que el aviso cubre razonablemente. Se puede
reconsiderar si el uso real muestra que las facturas mixtas son frecuentes y
materiales.

**Exigir el XML en lugar del TXT.** Resolvería el detalle de líneas de raíz, pero
descargar un XML por comprobante es inviable manualmente.

**Enviar las facturas mixtas a la bandeja.** Preciso pero inutilizable: cualquier
compra en supermercado o farmacia caería ahí.
