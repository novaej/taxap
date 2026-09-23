# ADR-010: Lista blanca de tipos de comprobante

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

La descarga de comprobantes recibidos del SRI no contiene solo facturas. Incluye
notas de crédito, notas de débito, liquidaciones de compra y comprobantes de
retención, en la columna `TIPO_COMPROBANTE`.

Existe la intuición razonable de que para el IVA solo cuentan las facturas. **Es
incorrecta, y el error va en la dirección peligrosa.**

Una **nota de crédito recibida** revierte parte de una compra —devolución,
descuento posterior, corrección— y lleva IVA. Si ya se tomó el crédito de la
factura original y la nota se ignora, se está reclamando crédito por algo que fue
devuelto. Es un error a favor del contribuyente, justamente el tipo que la
administración tributaria detecta.

## Decisión

**Lista blanca con tratamiento explícito por tipo.** Nunca una lista de exclusión.

| Tipo | Tratamiento en IVA compras |
|---|---|
| Factura | Suma |
| Nota de crédito | **Resta** — se vincula por `NUMERO_DOCUMENTO_MODIFICADO` |
| Nota de débito | Suma |
| Liquidación de compra | Suma |
| Comprobante de retención | **No aplica** — es una retención recibida, no una compra |

**Todo tipo no reconocido va a la bandeja de revisión.** No se descarta ni se
incluye en silencio. Si el SRI incorpora un tipo nuevo, el sistema lo señala en vez
de equivocarse calladamente.

Las notas de crédito se netean contra el comprobante que modifican. Cuando el
documento referenciado no está en el período cargado —porque la factura original es
de un período anterior—, la nota se procesa igual pero se marca, porque puede
requerir un ajuste que el sistema no puede resolver solo.

## Nota: comprobantes de retención y el casillero 609

"No aplica" se refiere a que un comprobante de retención **no es una compra** y no
va a los casilleros de adquisiciones. No significa que no tenga uso: el casillero
609 del formulario (retenciones de IVA que le han sido efectuadas en el período)
podría alimentarse de ellos. Pendiente de verificar con un archivo real; ver
[`formulario-104.md`](../tax/formulario-104.md).

## Estado de verificación

> **Pendiente de confirmación empírica.** Los tratamientos de esta tabla provienen
> del razonamiento sobre el dominio, no de la inspección de archivos reales. Los
> literales exactos de `TIPO_COMPROBANTE` deben verificarse contra descargas reales
> que incluyan cada tipo, y esta tabla actualizarse en consecuencia.
>
> Hasta entonces, la lista blanca es conservadora: cualquier literal no reconocido
> va a la bandeja, de modo que un literal mal escrito produce trabajo manual, no un
> cálculo incorrecto.

## Consecuencias

### Positivas
- El crédito tributario no se sobreestima por ignorar notas de crédito.
- Un tipo desconocido produce una pregunta al usuario, no un error silencioso.
- Las reglas de tratamiento están en un solo lugar y se prueban sin base de datos.

### Negativas
- El neteo de notas de crédito contra comprobantes de otros períodos es un caso
  límite genuino que el MVP marca pero no resuelve automáticamente.
- La lista blanca exige mantenimiento. Si el SRI renombra un tipo, todos los
  comprobantes de ese tipo caen a la bandeja hasta que alguien lo note — fricción
  visible, pero en la dirección segura.
