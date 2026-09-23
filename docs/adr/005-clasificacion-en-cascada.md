# ADR-005: Clasificación en cascada de cuatro niveles

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El planteamiento inicial proponía enviar cada compra a un modelo de IA para
clasificarla. Dos problemas, ninguno de costo:

**Inconsistencia entre períodos.** Un modelo de lenguaje puede clasificar al mismo
proveedor de una forma en marzo y de otra en abril. Para quien declara, eso es
inaceptable: la declaración de abril debe ser coherente con la de marzo.

**Irreproducibilidad.** Si el SRI cuestiona un período dos años después, hay que
poder explicar por qué cada comprobante se clasificó como se clasificó. "Un modelo
que ya no existe lo decidió" no es una respuesta.

Además, los archivos del SRI **no traen concepto ni descripción**
([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)). La única señal real es la
identidad del proveedor. Con la misma identidad y el mismo contexto, la respuesta
correcta es siempre la misma — lo que hace que un mecanismo determinista sea
naturalmente adecuado.

## Decisión

**Cascada de cuatro niveles.** Cada comprobante baja hasta que alguno resuelve.
Solo entran los comprobantes con `IVA > 0`.

| Nivel | Mecanismo | Determinista | Costo |
|---|---|---|---|
| 1 | Regla aprendida para (contribuyente, proveedor, actividad) | Sí | 0 |
| 2 | Catálogo compartido de proveedores | Sí | 0 |
| 3 | IA — **opcional** | No | ~$0.001 por proveedor nuevo |
| 4 | Bandeja de revisión manual | Humano | Tiempo del usuario |

**El ciclo de retroalimentación es el punto:** toda decisión del nivel 4 escribe una
regla de nivel 1. Lo que el usuario corrige hoy, el sistema lo sabe el mes que viene.

La consulta de IA es **por proveedor, no por comprobante**. Un período con 180
comprobantes de 60 proveedores distintos genera como mucho 60 consultas el primer
mes, y unas pocas después.

Toda clasificación registra `classification_source`, `rules_version` y —cuando
proviene de IA— `model_id` y `prompt_version`, para que cualquier veredicto sea
explicable después.

## Consecuencias

### Positivas
- El mismo proveedor se clasifica igual todos los períodos, por construcción.
- Cada veredicto tiene un origen citable.
- El sistema mejora con el uso en vez de costar lo mismo cada mes.
- El nivel 3 se puede apagar entero sin romper nada
  ([ADR-007](007-modo-sin-ia-y-catalogo-compartido.md)).

### Negativas
- Cuatro mecanismos que mantener en vez de uno.
- El primer período de cada contribuyente es trabajoso: sin reglas propias, casi
  todo depende de los niveles 2, 3 y 4.
- Una regla equivocada se propaga en silencio a todos los períodos siguientes. Por
  eso son revocables, quedan registradas con autor y fecha, y el desglose por
  casillero permite detectar el error.

## Sobre el costo

Se midió porque el argumento inicial lo sobredimensionaba:

| Escenario | Costo aproximado |
|---|---|
| Consulta por proveedor nuevo | ~$0.001 |
| Contribuyente nuevo, primer período | ~$0.06 |
| 80 contribuyentes, régimen estable | < $0.50 / mes |

**El ahorro no es la razón de esta decisión.** Incluso enviando cada comprobante a
la IA el costo sería irrelevante frente a la infraestructura. Las razones son la
consistencia y la reproducibilidad.

## Alternativas consideradas

**IA en cada comprobante.** Más simple de construir. Descartada por inconsistencia
entre períodos e irreproducibilidad ante una revisión.

**Solo reglas, sin IA y sin catálogo.** Completamente determinista, pero el primer
período de cada contribuyente obliga a clasificar manualmente cada proveedor, y
el producto deja de ahorrar trabajo justo cuando el usuario lo evalúa.
