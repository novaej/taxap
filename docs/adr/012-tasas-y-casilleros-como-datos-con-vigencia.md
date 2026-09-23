# ADR-012: Tasas y casilleros como datos con vigencia

> **Parcialmente reemplazado (2026-09-20):** la tabla única `form_casillero_map`
> descrita abajo se reemplaza por `form_versions`, `form_fields` y `result_mappings`: un
> administrador importa el formulario desde un PDF, el sistema guarda su catálogo y
> relaciona cada resultado con su casillero por significado. Ver
> [ADR-015](015-definicion-del-formulario-desde-pdf.md). Lo demás —tasas con
> vigencia, consulta por la fecha del hecho, visibilidad para el usuario— sigue
> vigente.

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Dos valores no pueden vivir como constantes en el código:

**La tasa de IVA.** Era 12% y hoy es 15%. La tasa aplicable depende de la **fecha de
emisión del comprobante**, no de la fecha actual. Un usuario que corrija un período
anterior necesita la tasa que regía entonces. Con la tasa fija en el código, el
sistema calcula mal en silencio para cualquier comprobante antiguo.

**El mapa de casilleros del formulario 104.** Es literalmente la salida del
producto: cada total tiene que ir al casillero correcto. Si el SRI modifica el
formulario, con el mapa en constantes cada cambio exige un despliegue — y se pierde
la capacidad de reproducir un período pasado con el formulario que regía entonces.

Hay un tercer valor que **no** entra aquí. Se consideró una tabla de
régimen → periodicidad para deducir si un contribuyente declara mensual o
semestralmente. Se descartó: **el SRI asigna la periodicidad directamente y consta
en el RUC del contribuyente.** Deducirla sería cuestionar la fuente autoritativa.
La ingresa el usuario al registrar cada contribuyente, y es editable.

## Decisión

**Dos tablas de referencia con vigencia, administradas por el sistema y visibles
para el usuario.**

```
tax_rates          (tax, rate, valid_from, valid_to)
form_casillero_map (form_code, form_version, casillero, description,
                    expression, valid_from, valid_to)
```

Toda consulta se resuelve **por la fecha del hecho**, no por la fecha actual: la
tasa se busca con la fecha de emisión del comprobante, y el mapa de casilleros con
la fecha del período.

**Visibles para el usuario.** Un usuario debe poder abrir un casillero y ver qué
tasa y qué versión del formulario usó el sistema. Esto no es un detalle de
implementación: es lo que permite verificar el cálculo en vez de confiar en él, y
es consistente con [ADR-014](014-caracter-asistivo-y-disclaimers.md).

El acompañamiento humano está en [`docs/tax/`](../tax/), que registra de dónde
salió cada valor y cuándo se verificó.

## Consecuencias

### Positivas
- Los períodos pasados se recalculan con las reglas que regían entonces.
- Una reforma de tasa es una fila nueva, no un despliegue.
- El usuario puede auditar los supuestos del sistema, lo que construye confianza
  mejor que cualquier texto de marketing.

### Negativas
- Toda operación con dinero necesita una consulta de tasa por fecha. Se resuelve
  con caché en memoria, pero es una dependencia que el código puro de `domain/` no
  puede resolver solo: la tasa se le **pasa** como parámetro, no la busca.
- Las tablas hay que mantenerlas. Un cambio normativo que nadie carga significa
  cálculos incorrectos con apariencia de normalidad. Debería existir una alerta
  cuando un período usa una vigencia que ya venció.

## Alternativas consideradas

**Constantes en TypeScript.** Más simple y con verificación de tipos. Descartada:
imposibilita recalcular períodos pasados y convierte cada reforma en un despliegue.

**Que el usuario ingrese la tasa.** Trasladaría el problema a quien no debería
cargarlo, y produciría inconsistencias entre contribuyentes del mismo usuario.
