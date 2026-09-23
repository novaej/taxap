# Formato de los archivos del SRI

Especificación de los archivos que el usuario descarga del portal del SRI y carga
en taxap. **Verificado contra archivos reales el 2026-09-20.**

Son archivos **`.txt` separados por tabulación**, no CSV. El parser se configura con
delimitador explícito; no se usa autodetección.

---

## Comprobantes recibidos (compras)

12 columnas:

```
RUC_EMISOR · RAZON_SOCIAL_EMISOR · TIPO_COMPROBANTE · SERIE_COMPROBANTE
CLAVE_ACCESO · FECHA_AUTORIZACION · FECHA_EMISION · IDENTIFICACION_RECEPTOR
VALOR_SIN_IMPUESTOS · IVA · IMPORTE_TOTAL · NUMERO_DOCUMENTO_MODIFICADO
```

Fila real:

```
1791287541001 │ MEGADATOS S.A. │ Factura │ 001-012-024304725
0108202601179128754100120010120243047251660131514
01/08/2026 04:05:03 │ 01/08/2026 │ 1715824775 │ 29.99 │ 4.5 │ 34.49 │ (vacío)
```

| Columna | Tipo | Notas |
|---|---|---|
| `RUC_EMISOR` | 13 dígitos | El proveedor |
| `RAZON_SOCIAL_EMISOR` | texto | Señal principal de clasificación |
| `TIPO_COMPROBANTE` | texto | Lista blanca — [ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md) |
| `SERIE_COMPROBANTE` | `EEE-PPP-SSSSSSSSS` | Establecimiento, punto de emisión, secuencial |
| `CLAVE_ACCESO` | 49 dígitos | Clave de deduplicación — ver abajo |
| `FECHA_AUTORIZACION` | `DD/MM/AAAA HH:MM:SS` | |
| `FECHA_EMISION` | `DD/MM/AAAA` | **Determina el período**, no la de autorización |
| `IDENTIFICACION_RECEPTOR` | 10 o 13 dígitos | El contribuyente. Cédula si es persona natural |
| `VALOR_SIN_IMPUESTOS` | decimal | Se almacena tal cual |
| `IVA` | decimal | `0` en comprobantes sin IVA |
| `IMPORTE_TOTAL` | decimal | |
| `NUMERO_DOCUMENTO_MODIFICADO` | texto o vacío | Solo en notas de crédito y débito |

## Comprobantes emitidos (ventas)

**8 columnas — estructura distinta**, no es el mismo archivo con menos datos:

```
COMPROBANTE · SERIE_COMPROBANTE · CLAVE_ACCESO · FECHA_AUTORIZACION
FECHA_EMISION · VALOR_SIN_IMPUESTOS · IVA · IMPORTE_TOTAL
```

Fila real:

```
Factura │ 001-001-000000034
0309202601171582477500120010010000000344465382615
04/09/2026 07:32:13 │ 03/09/2026 00:00:00 │ 2500 │ 0 │ 2500
```

Tres diferencias que obligan a un parser propio:

1. La columna se llama **`COMPROBANTE`**, no `TIPO_COMPROBANTE`.
2. **No hay identificación del emisor ni del receptor.** La pertenencia se valida
   con el RUC que va dentro de la clave de acceso.
3. **No hay `NUMERO_DOCUMENTO_MODIFICADO`.**
4. `FECHA_EMISION` incluye hora (`00:00:00`); en compras no.

---

## La clave de acceso

49 dígitos con estructura fija:

| Posición | Long. | Campo |
|---|---|---|
| 0–7 | 8 | Fecha de emisión `DDMMAAAA` |
| 8–9 | 2 | Tipo de comprobante |
| 10–22 | 13 | **RUC del emisor** |
| 23 | 1 | Ambiente (1 pruebas, 2 producción) |
| 24–29 | 6 | Serie: establecimiento + punto de emisión |
| 30–38 | 9 | Secuencial |
| 39–46 | 8 | Código numérico |
| 47 | 1 | Tipo de emisión |
| 48 | 1 | Dígito verificador |

### Verificación contra los ejemplos reales

**Compra — MEGADATOS:**
```
0108 2026 01 1791287541001 2 001012 024304725 4716601 3 1514
```
| Campo extraído | Columna del archivo | ¿Coincide? |
|---|---|---|
| `01082026` | `FECHA_EMISION` = 01/08/2026 | Sí |
| `1791287541001` | `RUC_EMISOR` | Sí |
| `001012` | `SERIE_COMPROBANTE` = 001-012-… | Sí |
| `024304725` | `SERIE_COMPROBANTE` = …-024304725 | Sí |

**Venta:**
```
0309 2026 01 1715824775001 2 001001 000000034 44653826 1 5
```
| Campo extraído | Columna del archivo | ¿Coincide? |
|---|---|---|
| `03092026` | `FECHA_EMISION` = 03/09/2026 | Sí |
| `1715824775001` | *(no hay columna)* | Es el RUC del contribuyente |
| `001001` | `SERIE_COMPROBANTE` = 001-001-… | Sí |
| `000000034` | `SERIE_COMPROBANTE` = …-000000034 | Sí |

**Conclusión operativa:** la clave de acceso es autodescriptiva y valida de forma
cruzada las demás columnas. Sirve simultáneamente para deduplicar, verificar
integridad y confirmar pertenencia
([ADR-009](../adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)).

> En la venta de ejemplo, `1715824775001` es el RUC del contribuyente, formado por
> la cédula `1715824775` —la misma que aparece como `IDENTIFICACION_RECEPTOR` en el
> archivo de compras— más `001`. Ambos archivos pertenecen al mismo contribuyente.

---

## Restricciones operativas

**El SRI solo permite consultar por día.** Un período mensual puede requerir 31
descargas. Consecuencias de diseño:

- La carga debe aceptar **múltiples archivos a la vez** y permitir agregar más a un
  período ya iniciado.
- Los días sin movimiento producen archivos **solo con encabezado**. No son un error.
- La deduplicación por clave de acceso hace que el orden y la repetición sean
  irrelevantes.

**Casos verificados en los ejemplos:**

- `IVA = 0` en ventas. En el ejemplo, una venta de $2.500 sin IVA. El archivo **no
  dice** si es exportación, venta 0% con derecho a crédito, 0% sin derecho, o no
  objeto: son destinos distintos del formulario y de ellos depende el factor de
  proporcionalidad. Ver [`formulario-104.md`](formulario-104.md).
- Decimales sin ceros a la derecha: `4.5`, no `4.50`. El parser no debe asumir dos
  decimales en el texto de origen.
- Montos enteros sin separador decimal: `2500`.

---

## Pendiente de verificar

- [ ] Literales exactos de `TIPO_COMPROBANTE` para notas de crédito, notas de
      débito, liquidaciones de compra y comprobantes de retención. Solo se
      verificaron facturas.
- [ ] Formato de `NUMERO_DOCUMENTO_MODIFICADO` en una nota de crédito real.
- [ ] Si el archivo de compras admite rangos de fechas o también es por día.
- [ ] Presencia y formato exacto de la fila de encabezado.
- [ ] Codificación del archivo (UTF-8 o Latin-1) — afecta a las razones sociales
      con tildes y con `Ñ`.
