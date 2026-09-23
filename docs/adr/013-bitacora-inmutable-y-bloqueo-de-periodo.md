# ADR-013: Bitácora inmutable y bloqueo de período

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El planteamiento inicial guardaba la confianza y el razonamiento de la IA en
columnas de la propia fila del comprobante. Eso significa que al reclasificar, el
valor anterior se sobrescribe: se pierde qué decía antes, quién lo cambió y por qué.

Para este producto es una carencia grave. Si la administración tributaria cuestiona
un período dos años después, hay que poder responder **por qué** cada comprobante se
clasificó como se clasificó. Una columna con el estado final no responde eso.

Hay un segundo problema: una vez que el usuario presenta la declaración ante el SRI,
los datos que la sustentan no deberían poder cambiar. Si alguien reclasifica un
comprobante de un período ya declarado, el sistema deja de coincidir con lo
presentado, sin dejar rastro de la divergencia.

## Decisión

**Dos mecanismos, ambos impuestos en la base de datos, no en la aplicación.**

**1. Bitácora inmutable.** `classification_events` registra cada cambio de
clasificación: comprobante, campo, valor anterior, valor nuevo, quién
(usuario o motor), con qué origen, bajo qué versión de reglas y —si fue IA— con qué
modelo y versión de prompt.

Un disparador rechaza `UPDATE` y `DELETE`. La tabla solo crece. Las correcciones se
registran como eventos nuevos, nunca modificando los anteriores.

**2. Bloqueo de período.** Al pasar `tax_periods.status` a `FILED` se fija
`locked_at`. Un disparador rechaza toda modificación de comprobantes de un período
bloqueado. Para corregir, se reabre el período explícitamente — y esa reapertura es
a su vez un evento registrado.

Ambos disparadores viven en PostgreSQL porque la aplicación no es el único camino a
los datos: una consulta administrativa, un script de mantenimiento o un futuro
proceso de importación también deben respetarlos.

## Consecuencias

### Positivas
- Existe una respuesta citable a "¿por qué se clasificó así?", con autor y fecha.
- Un período declarado no puede divergir de lo presentado sin dejar rastro.
- La inmutabilidad no depende de que el código de la aplicación se comporte bien.
- La bitácora es la base natural de la trazabilidad por casillero que pide el MVP.

### Negativas
- `classification_events` crece rápido: varias filas por comprobante en el primer
  período. Necesitará una política de archivado, aunque no en el MVP.
- Los disparadores de inmutabilidad complican las pruebas y las migraciones: hay
  que preverlos al limpiar datos de desarrollo.
- Reabrir un período es fricción deliberada. Si resulta demasiado incómodo en el uso
  real, la tentación será relajarlo — y ahí se pierde la garantía. **El flujo de
  reapertura debe diseñarse bien, no dejarse como caso límite.**

## Alternativas consideradas

**Columnas de estado en el comprobante, sin bitácora.** Era el planteamiento
inicial. Más simple y suficiente para mostrar la pantalla actual, pero no responde
ninguna pregunta sobre el pasado.

**Bitácora en la aplicación, sin disparadores.** Funciona mientras todo acceso pase
por la aplicación. El primer script de mantenimiento que toque la base rompe la
garantía justo cuando más se necesita.

**Versionado de filas completas.** Más completo, y mucho más pesado. La bitácora por
campo cubre la pregunta real —qué cambió en la clasificación— a una fracción del
costo.
