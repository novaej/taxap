# ADR-011: Ingesta y clasificación en dos pasos reanudables

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Se consideró inicialmente una cola de trabajos (pg-boss o similar) para procesar la
carga, asumiendo un volumen alto de procesamiento por archivo.

Al revisar los archivos reales del SRI, el supuesto resultó falso. Son TXT separados
por tabulación con una fila por comprobante y ocho a doce columnas. Parsear miles de
filas toma segundos, y la clasificación consulta a la IA **por proveedor, no por
comprobante** ([ADR-005](005-clasificacion-en-cascada.md)): decenas de consultas,
no miles.

Queda un riesgo real: si la petición HTTP se corta a la mitad —tiempo de espera
agotado, despliegue, red del usuario—, ¿qué pasa con lo ya procesado?

## Decisión

**Sin cola de trabajos. Dos pasos separados, cada uno idempotente.**

**Paso 1 — Ingesta.** Síncrono. Parsea, valida, deduplica por clave de acceso
([ADR-009](009-clave-de-acceso-como-clave-de-deduplicacion.md)) e inserta con
`processing_status` sin clasificar. Segundos. Si algo falla después, nada se perdió:
los comprobantes están guardados.

**Paso 2 — Clasificación.** Toma los comprobantes sin clasificar del período, los
pasa por la cascada y los marca. **Reanudable**: volver a ejecutarlo continúa donde
quedó, sin duplicar trabajo ni reconsultar a la IA por proveedores ya resueltos.
El usuario lo dispara explícitamente y puede repetirlo sin consecuencias.

La reanudabilidad viene de que el estado vive en la fila del comprobante, no en
memoria ni en un mensaje de cola. No hace falta infraestructura para saber dónde
quedó el proceso: basta consultar qué sigue sin clasificar.

## Consecuencias

### Positivas
- Ninguna infraestructura adicional: ni Redis, ni broker, ni proceso trabajador.
- Una interrupción nunca deja el período en estado inconsistente.
- El usuario tiene control explícito: carga, revisa lo cargado, clasifica.
- Separar los pasos deja la puerta abierta a una cola más adelante sin rediseñar
  nada — el paso 2 ya es una unidad de trabajo reanudable.

### Negativas
- El paso 2 corre dentro de una petición HTTP y puede acercarse a los límites de
  tiempo de espera con un primer período grande y muchos proveedores nuevos. Se
  mitiga procesando por lotes y devolviendo control, pero **hay que medirlo con un
  período real antes de dar la decisión por buena.**
- No hay reintento automático. Si el paso 2 falla, el usuario tiene que volver a
  dispararlo. Aceptable porque es reanudable y la acción es explícita.
- Sin cola no hay control de concurrencia: dos ejecuciones simultáneas del paso 2
  sobre el mismo período pueden duplicar consultas a la IA. Se resuelve con un
  bloqueo consultivo de PostgreSQL por período, no con infraestructura nueva.

## Alternativas consideradas

**pg-boss.** Cola sobre el mismo PostgreSQL, sin infraestructura extra y
transaccional con los datos. Era la recomendación inicial, hecha bajo el supuesto
equivocado de un procesamiento pesado. Sigue siendo la primera opción **si la
medición muestra que el paso 2 no cabe en una petición.**

**BullMQ con Redis.** Más capacidad y mejores reintentos, a cambio de un servicio
más que operar. Desproporcionado para este volumen.
