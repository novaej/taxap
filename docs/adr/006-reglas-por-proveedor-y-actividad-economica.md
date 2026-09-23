# ADR-006: Reglas por proveedor y actividad económica

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El nivel 1 de la cascada ([ADR-005](005-clasificacion-en-cascada.md)) recuerda cómo
se clasificó antes a un proveedor. Queda definir cuál es la clave de esa memoria.

Los archivos del SRI traen, como señal utilizable: el RUC y la razón social del
emisor, el tipo de comprobante y los montos. **No traen concepto ni descripción**
([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)).

Pero el proveedor solo no alcanza. El mismo proveedor significa cosas distintas
según quién compra:

| Proveedor | Compañía de taxis | Estudio jurídico | Restaurante |
|---|---|---|---|
| Distribuidora de combustible | Gasto operacional central | Probablemente mixto | Marginal |
| Cadena de supermercados | Difícilmente deducible | Difícilmente deducible | Insumo deducible |

Lo que cambia entre columnas es la **actividad económica del contribuyente**. Y esa
actividad no es fija: un contribuyente puede agregar una actividad nueva al RUC, y
entonces compras que antes eran claramente no deducibles pasan a ser gasto
operacional del negocio nuevo.

## Decisión

**La clave de una regla es `(contribuyente, proveedor, huella de actividad económica)`.**

```
supplier_rules
├── taxpayer_id
├── supplier_ruc
├── activity_fingerprint   ← hash del conjunto de actividades al crearse la regla
├── iva_category
├── source, created_by, created_at, revoked_at
```

Cuando cambian las actividades económicas del contribuyente, `activity_fingerprint`
se recalcula. Las reglas emitidas bajo la huella anterior **no se borran ni se
aplican en silencio**: quedan marcadas como pendientes de revalidación y sus
comprobantes caen a la bandeja. El usuario las reconfirma de forma masiva y la
regla se reemite con la huella nueva.

Las reglas nunca se eliminan físicamente; se revocan con `revoked_at`, porque la
bitácora ([ADR-013](013-bitacora-inmutable-y-bloqueo-de-periodo.md)) referencia la
regla que aplicó en su momento.

## Consecuencias

### Positivas
- Las reglas reflejan el criterio de quien declara para ese contribuyente
  concreto, no un criterio genérico impuesto.
- Un cambio de actividad económica no corrompe silenciosamente períodos futuros.
- El historial de reglas revocadas explica por qué un período viejo se calculó
  como se calculó.

### Negativas
- Un cambio de actividad económica devuelve mucho trabajo a la bandeja de golpe.
  Se mitiga con revalidación masiva, pero es fricción real y visible.
- La huella es un hash: si cambia el orden o el formato de las actividades sin que
  cambie su contenido, se invalidan reglas sin motivo. **La huella debe calcularse
  sobre los códigos normalizados y ordenados**, nunca sobre el texto crudo.

## Alternativas consideradas

**Clave solo por proveedor, global a todo el sistema.** Mucha más cobertura desde
el primer día, pero impone el criterio de un usuario sobre otro en casos donde
legítimamente difieren. Esa idea sobrevive, pero como **sugerencia** en el catálogo
compartido ([ADR-007](007-modo-sin-ia-y-catalogo-compartido.md)), no como regla.

**Clave por proveedor y concepto.** Era el diseño original. Inviable: la fuente no
trae concepto.

**Ignorar la actividad económica.** Más simple, y funciona mientras el
contribuyente no cambie de giro. Falla en silencio cuando lo hace, que es
exactamente el tipo de fallo que este producto no puede permitirse.
