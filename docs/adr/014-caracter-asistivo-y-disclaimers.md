# ADR-014: Carácter asistivo del sistema

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

taxap calcula valores que alimentan una declaración tributaria. Una declaración
incorrecta genera consecuencias reales —multas, intereses, glosas— para el
contribuyente, y el responsable ante la administración tributaria es siempre él o su
contador, nunca el software.

Además, el sistema tiene limitaciones conocidas y estructurales que no se pueden
resolver, porque provienen de la fuente de datos:

- Trabaja con totales, no con el detalle de líneas
  ([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)).
- No distingue 0%, exento y no objeto de IVA.
- Clasifica a partir del proveedor y la actividad económica, sin concepto.
- Parte de sus clasificaciones provienen de inferencia, no de certeza.

Un producto que presente sus resultados como definitivos estaría tergiversando lo
que hace, y creando una expectativa que no puede sostener.

## Decisión

**El carácter asistivo se expresa en el diseño del producto, no solo en un texto
legal.** Tres niveles:

**1. En el lenguaje.** No existe un botón "Declarar". No existe el estado "Listo
para declarar". El vocabulario del producto es:

| Se usa | No se usa |
|---|---|
| Borrador generado | Declaración lista |
| Pendiente de revisión | Procesado, sin más |
| Valor sugerido | Valor calculado |
| Marcar como declarado | Declarar |

**2. En la interfaz.** Aviso permanente —no descartable— en la pantalla de
pre-declaración y en todo borrador exportado o impreso:

> Los valores presentados son un cálculo asistido a partir de los archivos
> cargados y deben ser revisados y validados por el responsable antes de
> presentarse al SRI. Este sistema no presenta declaraciones ni sustituye el
> criterio profesional.

Y un aviso específico sobre el alcance de los datos:

> Los cálculos se basan en los totales de cada comprobante. Los archivos del SRI
> no incluyen el detalle de líneas, por lo que si necesita desagregar un
> comprobante debe revisar el original.

**3. En la aceptación.** Al registrarse, el usuario acepta los términos de forma
explícita. La aceptación se versiona y se registra con quién y cuándo, siguiendo
el patrón de `comprobify`.

**Corolario de diseño:** el sistema nunca oculta su incertidumbre para verse mejor.
Un comprobante que no se pudo clasificar con confianza va a la bandeja aunque eso
haga ver al producto menos automático. La trazabilidad por casillero existe
precisamente para que el usuario pueda desconfiar y verificar.

## Consecuencias

### Positivas
- Lo que el producto promete coincide con lo que hace.
- La responsabilidad queda donde legal y profesionalmente corresponde.
- Empuja decisiones de diseño sanas: trazabilidad, bandeja visible, supuestos
  inspeccionables ([ADR-012](012-tasas-y-casilleros-como-datos-con-vigencia.md)).

### Negativas
- Comercialmente es menos atractivo que "declara en un clic". Es el costo de ser
  exacto sobre lo que el sistema hace.
- Los avisos permanentes ocupan espacio y, con el uso repetido, dejan de leerse.
  Mitigado haciéndolos específicos y contextuales en vez de un bloque genérico.
- Un usuario puede aun así confiar ciegamente. El aviso reduce el riesgo, no lo
  elimina. Por eso la mitigación real es la trazabilidad: que revisar sea fácil.

## Nota

Este ADR describe una postura de producto y diseño. **No constituye asesoría legal
ni sustituye una revisión de términos y condiciones por un profesional**, que debe
hacerse antes de abrir el producto a usuarios reales.
