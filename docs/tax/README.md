# Referencia tributaria

Este directorio registra **de dónde salen los valores normativos que usa el
sistema y cuándo se verificaron**, para que dentro de un año se pueda saber si
siguen vigentes.

No es la normativa. Es el acompañamiento humano de las tablas
`tax_rates` y de las tablas de definición del formulario (`form_fields`), que son las que el código consulta
([ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md)).

| Documento | Contenido |
|---|---|
| [`formato-archivos-sri.md`](formato-archivos-sri.md) | Estructura de los `.txt` del portal. **Verificado contra archivos reales.** |
| [`tasas-iva.md`](tasas-iva.md) | Historial de tasas con vigencia |
| [`formulario-104.md`](formulario-104.md) | Catálogo de casilleros. **Verificado contra un formulario real.** Incluye decisiones abiertas. |

## Regla de este directorio

Todo valor numérico lleva **fuente y fecha de verificación**. Un valor sin eso se
marca `[VERIFICAR]` y no se carga a las tablas del sistema hasta confirmarse.

Es deliberado: es preferible que un dato falte de forma visible a que exista uno
incorrecto con apariencia de verificado.

## Lo que no está aquí

La **periodicidad de declaración** no es un dato normativo derivado en este sistema.
El SRI la asigna a cada contribuyente y consta en su RUC; el usuario la ingresa al
registrar el contribuyente y es editable. Ver
[ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md).
