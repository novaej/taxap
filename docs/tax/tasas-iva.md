# Tasas de IVA

Alimenta la tabla `tax_rates`. La tasa aplicable se resuelve por la **fecha de
emisión del comprobante**, nunca por la fecha actual
([ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md)).

## Tabla

| Tasa | Vigente desde | Vigente hasta | Fuente | Verificado |
|---|---|---|---|---|
| 15% | `[VERIFICAR]` 2024 | — | `[VERIFICAR]` | ❌ |
| 12% | `[VERIFICAR]` | `[VERIFICAR]` 2024 | `[VERIFICAR]` | ❌ |

> **Ninguna fila está verificada.** Antes de cargar esta tabla al sistema hay que
> confirmar las fechas exactas de vigencia contra la normativa y registrar la
> fuente. Hasta entonces el sistema no debe calcular períodos anteriores a la
> vigencia confirmada de la tasa actual.

## Evidencia disponible

De la factura real analizada en
[`formato-archivos-sri.md`](formato-archivos-sri.md):

```
VALOR_SIN_IMPUESTOS = 29.99    IVA = 4.50
4.50 / 29.99 = 15.005%    →    tasa 15%, con redondeo
```

Confirma que en agosto de 2026 la tasa es 15%. **No confirma desde cuándo.**

## Por qué importa la vigencia

Con la tasa fija en el código, un comprobante de un período anterior a la reforma se
calcula con la tasa equivocada **sin producir ningún error visible**. El sistema
muestra un número y ese número está mal.

Hace falta cuando:
- El usuario corrige o reconstruye un período anterior.
- Un comprobante llega con fecha de emisión antigua.
- Una nota de crédito modifica una factura emitida bajo la tasa anterior.

## Tarifa cero, exento y no objeto

Los archivos del SRI traen `IVA = 0` sin distinguir entre los tres casos. No se
modela esa distinción porque **la fuente no la contiene**
([ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md)).

Se agrupan en un bucket único sin decisión por comprobante. Si el formulario los
separa, el usuario ajusta manualmente, y la interfaz lo advierte.
