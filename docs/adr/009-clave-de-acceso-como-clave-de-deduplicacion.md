# ADR-009: La clave de acceso como clave de deduplicación e integridad

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El portal del SRI solo permite consultar comprobantes **por día**. Un período
mensual requiere hasta 31 descargas, y un semestral muchas más. El usuario va a
cargar decenas de archivos por período, con solapamientos y repeticiones casi
garantizados.

Sin una clave de deduplicación confiable, la segunda carga duplica los totales y el
producto pierde la confianza del usuario en su primer uso.

Todos los comprobantes traen la **clave de acceso**, 49 dígitos que el SRI genera
con una estructura fija:

```
fecha(8) tipo(2) RUC(13) ambiente(1) serie(6) secuencial(9) código(8) emisión(1) verificador(1)
```

Verificada contra dos comprobantes reales:

```
0108202601 1791287541001 2 001012 024304725 ...
  01/08/26   RUC emisor      001-012  024304725
```

Los campos internos **coinciden con las demás columnas del archivo**: fecha de
emisión, tipo de comprobante, RUC del emisor y serie.

## Decisión

**La clave de acceso cumple dos funciones.**

**1. Deduplicación.** Restricción única `(taxpayer_id, access_key)`. La ingesta
inserta ignorando conflictos, así que recargar un archivo —o el mismo día en dos
archivos distintos— no duplica nada. El usuario puede cargar los 31 archivos en
cualquier orden y repetirlos sin consecuencias.

**2. Validación de integridad.** En cada fila se descompone la clave y se contrasta
contra las demás columnas. Si no concuerdan, la fila se rechaza y se reporta: el
archivo está corrupto o fue manipulado.

**Validación de pertenencia**, por caminos distintos según el archivo:

| Archivo | Cómo se valida el contribuyente |
|---|---|
| Comprobantes recibidos | `IDENTIFICACION_RECEPTOR` debe corresponder al contribuyente |
| Comprobantes emitidos | El RUC **dentro de la clave de acceso** debe ser el del contribuyente |

El archivo de emitidos no trae columna de identificación del emisor; la clave de
acceso la suple. Si no coincide, se aborta la carga completa: el usuario subió el
archivo de otro cliente, y detectarlo antes de contaminar el período es lo que
importa.

## Consecuencias

### Positivas
- La recarga es idempotente por construcción. La interfaz puede ofrecer "arrastre
  todos sus archivos" sin ninguna advertencia.
- Detección temprana de archivos corruptos o del cliente equivocado, antes de que
  lleguen a un cálculo.
- No hace falta inventar una clave natural compuesta ni confiar en el nombre del
  archivo.

### Negativas
- Se asume que el SRI no reutiliza claves de acceso entre comprobantes. Es el
  diseño del sistema, pero es una dependencia externa.
- La validación cruzada puede rechazar filas legítimas si el SRI cambia el formato
  de alguna columna (por ejemplo, el formato de fecha). Por eso el rechazo **reporta
  la fila al usuario** en lugar de descartarla en silencio.
- `sha256` sobre el archivo completo detecta la resubida idéntica antes de parsear,
  pero no sustituye a la deduplicación por fila: dos archivos distintos pueden
  compartir comprobantes.
