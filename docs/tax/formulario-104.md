# Formulario 104 — Casilleros y relación con los resultados

**Fuente:** comprobante de declaración de IVA descargado del portal del SRI
(obligación `2011 DECLARACION DE IVA`, período agosto 2026, 6 páginas).
**Verificado:** 2026-09-20. El PDF original no se guarda en el proyecto; la copia local
vive en `samples/`, fuera del repositorio, porque contiene datos tributarios reales.

> **El formulario es el destino de los resultados, no una fuente de cálculo.**
> taxap calcula con su propia lógica (`src/domain/`) a partir de los comprobantes y de
> lo que el usuario marca. Cada resultado se presenta junto al casillero donde el
> usuario debe ingresarlo:
>
> ```
> Adquisiciones con derecho a crédito tributario (valor bruto) — 500 = 1,000.00
> ```
>
> El administrador sube el formulario una vez y el sistema guarda su catálogo completo
> de campos. Al calcular, el sistema **relaciona cada resultado con el campo que le
> corresponde**, aproximadamente, por su significado; el código no conoce números de
> casillero ([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)).
> Las fórmulas que el formulario imprime se transcriben aquí como referencia para quien
> implementa el dominio; el sistema no las lee ni las ejecuta. Los valores del PDF de
> muestra no se usan para nada.

**El MVP cubre solo el formulario mensual, y solo lo básico de ventas y compras.**

---

## Cómo está construido

Cada fila del formulario tiene una descripción y uno de tres formatos:

| Formato | Ejemplo | Columnas |
|---|---|---|
| **Terna** | `500 · 510 · 520` | Valor bruto · Valor neto · Impuesto generado |
| **Valor único** | `499` | Un solo casillero |
| **Conteo o texto** | `111`, `881` | Cantidad de comprobantes, o `SI`/`NO` |

**Valor neto = valor bruto − notas de crédito.** Las notas de crédito restan en el
neto, no cuentan como una compra o venta más
([ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)).

Las ternas siguen un patrón numérico, útil para validar la lectura del PDF:
`401·411·421`, `500·510·520`, `502·512·522`.

Secciones, en orden:

| Sección | Casilleros | MVP |
|---|---|---|
| Encabezado y decreto turístico | 203 | Fuera |
| **Resumen de ventas** | 401–454 | **Sí (básico)** |
| Liquidación del IVA en el mes | 480–499, 111, 113 | Fuera |
| **Resumen de adquisiciones y pagos** | 500–565, 115–119 | **Sí (básico)** |
| Resumen impositivo | 601–624 | Fuera |
| Subtotal a pagar y consolidado | 620–699, 859 | Fuera |
| Devolución ISD a exportadores | 700–702 | Fuera |
| Agente de retención de IVA | 721–802 | Fuera |
| Pagos, imputación y valores a pagar | 880–999 | Fuera |

---

## Resultados del MVP y casillero esperado

Cada resultado tiene una **clave estable** y una **descripción estructurada** definidas
en el dominio:

| Atributo | Valores |
|---|---|
| Operación | venta · compra |
| Tratamiento | gravado · 0% con derecho a crédito · 0% sin derecho · exportación de bienes · exportación de servicios · no objeto o exento · con derecho a crédito · sin derecho a crédito |
| Columna | bruto · neto · impuesto |
| Activo fijo | no (el MVP no los distingue) |

El sistema compara esa descripción con los nombres oficiales del catálogo del
formulario y sugiere el campo más cercano
([ADR-015](../adr/015-definicion-del-formulario-desde-pdf.md)). La relación es una
aproximación: se muestra siempre con el nombre oficial del campo y **con la razón por la
que se ubicó ahí**. Nadie la corrige a mano.

**Las columnas "Casillero" de las tablas siguientes no las usa el sistema.** Son el
casillero que se **espera** para cada resultado en esta versión del formulario, y sirven
de **conjunto de pruebas del emparejamiento**: si un cambio de reglas o un formulario
nuevo hace que un resultado ya no caiga donde se espera, la prueba lo detecta.

### Ventas — desde `invoices_issued`

| Clave del resultado | Bruto · Neto · Impuesto | Descripción en el formulario | Qué lo alimenta |
|---|---|---|---|
| `SALES_TAXED` | 401 · 411 · 421 | Ventas locales (excluye activos fijos) gravadas tarifa diferente de cero | Comprobantes con `IVA > 0` |
| `SALES_ZERO_NO_CREDIT` | 403 · 413 | Ventas locales gravadas tarifa 0% que **no** dan derecho a crédito tributario | Marcadas por el usuario |
| `SALES_ZERO_WITH_CREDIT` | 405 · 415 | Ventas locales gravadas tarifa 0% que **sí** dan derecho a crédito tributario | Marcadas por el usuario |
| `EXPORT_GOODS` | 407 · 417 | Exportaciones de bienes | Marcadas por el usuario |
| `EXPORT_SERVICES` | 408 · 418 | Exportaciones de servicios y/o derechos | Marcadas por el usuario |
| `SALES_NON_OBJECT_EXEMPT` | 431 · 441 | Transferencias no objeto o exentas de IVA | Marcadas por el usuario |

Neto = bruto − notas de crédito emitidas. La columna de impuesto solo aplica a
`SALES_TAXED`.

### Adquisiciones — desde `invoices_received`, solo `IVA > 0`

| Clave del resultado | Bruto · Neto · Impuesto | Descripción en el formulario | Qué lo alimenta |
|---|---|---|---|
| `PURCHASES_WITH_CREDIT` | 500 · 510 · 520 | Adquisiciones y pagos (excluye activos fijos) gravados tarifa diferente de cero **con** derecho a crédito tributario | `iva_category = CREDIT` |
| `PURCHASES_NO_CREDIT` | 502 · 512 · 522 | Otras adquisiciones y pagos gravados tarifa diferente de cero **sin** derecho a crédito tributario | `iva_category = COST_EXPENSE` y `NON_DEDUCTIBLE` `[VERIFICAR]` |

### Factor y crédito

| Clave del resultado | Casillero | Descripción en el formulario |
|---|---|---|
| `PROPORTIONALITY_FACTOR` | 563 | Factor de proporcionalidad para crédito tributario |
| `CREDIT_APPLICABLE` | 564 | Crédito tributario aplicable en este período |
| `VAT_NOT_CREDITED` | 565 | Valor de IVA no considerado como crédito tributario por factor de proporcionalidad |

Es posible que el portal calcule estos tres a partir de lo ingresado en las ventas y
compras; en ese caso el sistema los entrega como **valor de contraste**, no como algo
que el usuario deba teclear `[VERIFICAR]`.

### Sin casillero definitivo

| Clave del resultado | Qué es | Situación |
|---|---|---|
| `PURCHASES_ZERO_VAT` | Total de compras con `IVA = 0` | No afecta al crédito de IVA. Se muestra como total informativo. Como el sistema relaciona por significado, puede sugerir el campo más cercano (507, con 508, 531 y 532 como alternativas) **marcado como aproximado**; el usuario decide si lo usa. |

Un resultado sin casillero identificado es válido: se muestra sin código y no bloquea
nada.

### Lo que estos resultados dejan listo para Renta

Renta queda fuera del MVP, pero los resultados ya llevan lo que después sumará:

- Base de compras y IVA por destino (`PURCHASES_WITH_CREDIT`, `PURCHASES_NO_CREDIT`).
- **El IVA que se vuelve costo:** el de `PURCHASES_NO_CREDIT` más `VAT_NOT_CREDITED`.
- Total de ventas por destino.
- `PURCHASES_ZERO_VAT`, que sin IVA no importa para el crédito pero sí es un gasto
  potencial para Renta.

---

## El factor de proporcionalidad

Fórmula de referencia (no se ejecuta; la lógica vive en `src/domain/`):

```
563 = (411+412+420+435+415+416+417+418) / 419
564 = (520+521+534+560+523+524+525+526−527) × 563
```

En el alcance del MVP el numerador es `411 + 415 + 417 + 418` y el crédito es
`520 × 563`.

**Exportaciones (417, 418) y ventas 0% con derecho a crédito (415, 416) cuentan en el
numerador.** Un contribuyente cuyas ventas son solo exportaciones de servicios tiene
factor **1.0000**. El factor solo es cero si todas las ventas caen en destinos que no
entran al numerador (403, 404, 431).

> Documentos anteriores decían que con ventas sin IVA el factor era cero. Era
> incorrecto. Es un hecho sobre la lógica que el dominio debe implementar, no un dato
> que el sistema tome del formulario.

Formato: **4 decimales** (`1.0000`).

**Bloqueo:** el factor no se calcula mientras existan ventas con `IVA = 0` sin destino
marcado por el usuario. Un factor sobre ventas sin clasificar sería un número con
apariencia de exacto.

**Caso pendiente:** sin ventas en el período el denominador es cero y el factor es
una división 0/0. Hay que definir qué resultado ofrece el sistema `[VERIFICAR]`.

---

## Decisiones tomadas

**Ventas con `IVA = 0`: las marca el usuario en una tabla.** Tras cargar los
comprobantes emitidos, el sistema los muestra y el usuario marca el destino de cada
venta con `IVA = 0`, una por una o en bloque. Las de `IVA > 0` van solas a
`SALES_TAXED`. El archivo de emitidos no trae cliente ni concepto, así que no hay
reglas aprendidas: el criterio siempre es del usuario. Cada marca queda en la
bitácora ([ADR-013](../adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

**Compras con `IVA = 0`: sin decisión por comprobante.** No afectan al crédito, así que
no se reparten entre 507, 508, 531 y 532. Se conservan los comprobantes y se muestra un
total informativo (`PURCHASES_ZERO_VAT`), con un casillero aproximado sugerido.

**Solo lo básico de ventas y compras.** El sistema entrega qué poner en ventas y en
adquisiciones. No calcula la liquidación, los saldos de crédito del mes anterior ni el
total a pagar.

**Sin `attribution`.** El modelo de datos tenía una categoría de atribución
(directa gravada, directa exenta, prorrateable). Se elimina: el formulario ya la
expresa con 500 (con derecho a crédito) y 502 (sin derecho), más el factor. La
clasificación de una compra es **500 o 502**, y la decide el usuario o la regla
aprendida, no un tercer concepto. Que una compra atribuible solo a ventas exentas
corresponda al 502 es criterio del usuario `[VERIFICAR]`.

**Solo el formulario mensual.** El semestral es otro formulario, con casilleros
propios, y queda fuera. Un contribuyente semestral puede registrarse, pero el MVP no
genera su pre-declaración y lo indica.

---

## Fuera del MVP

| Casilleros | Concepto | Razón |
|---|---|---|
| 402·412·422, 404·414, 406·416, 501·511·521 | Activos fijos | El archivo no distingue un activo fijo de otra compra. Todo va a 401 / 500; el usuario ajusta a mano. |
| 410·420·430, 530·533·534 | Tarifa variable | Requeriría derivar la tasa de `IVA / subtotal`, que [ADR-008](../adr/008-solo-totales-sin-detalle-de-lineas.md) descarta. |
| 425·435·445, 540·550·560 | Tarifa 5% | Ídem. |
| 503–505, 523–525 | Importaciones | Se documentan con la declaración aduanera. |
| 423, 424, 526, 527 | Ajustes por diferencia de tarifa | Requieren detalle que el archivo no trae. |
| 442, 443, 453, 543, 544, 554 | Notas de crédito por compensar próximo mes | Caso límite de ADR-010. |
| 434, 444, 454, 535, 545, 555 | Reembolsos como intermediario | Informativo. |
| 506–508, 516–518, 531–532, 541–542 | Compras con `IVA = 0` | Sin efecto en el crédito. |
| 409·419·429, 509·519·529 | Totales | El portal los suma `[VERIFICAR]`. No son "qué poner", son consecuencia. |
| 111–119 | Conteos de comprobantes | Informativo. `[VERIFICAR]` si son obligatorios. |
| 480–499 | Liquidación del mes | Fuera de "qué poner en ventas y compras". |
| 601–625 | Resumen impositivo, **saldos de crédito de meses anteriores (605)**, compensaciones, ajustes | Los saldos vienen de la declaración anterior y no de los comprobantes. Fuera. |
| 620–699, 859 | Subtotal, retenciones en ventas, total consolidado | Fuera. |
| 700–802 | ISD, agente de retención de IVA | Otro rol tributario. |
| 880–999 | Pagos, intereses, multas, pago diferido COVID | Posteriores a la declaración. |
| 203 | Decreto de tarifa turística | Selector; no aplica. |

### Dos casos a revisar más adelante

- **609** (retenciones de IVA que le han sido efectuadas): los comprobantes de
  retención recibidos podrían alimentarlo. [ADR-010](../adr/010-tratamiento-por-tipo-de-comprobante.md)
  los trata como "no aplica" para adquisiciones, correcto para 500/502, pero no
  significa que no valgan nada. Requiere un archivo real con un comprobante de
  retención `[VERIFICAR]`.
- **605** y los demás saldos: si se decide cubrir la liquidación, hará falta un
  mecanismo de arrastre entre períodos o de ingreso manual.

---

## Pendiente de verificar

- [ ] Si el portal calcula 563, 564 y 565 a partir de las ventas y compras ingresadas
- [ ] Si el portal suma los totales 409/419/429 y 509/519/529
- [ ] Valor del factor cuando no hay ventas (denominador cero)
- [ ] Tratamiento de `NON_DEDUCTIBLE` frente a 502
- [ ] Criterio para compras atribuibles solo a ventas exentas
- [ ] Si los comprobantes de retención recibidos alimentan el 609
- [ ] Fecha desde la que rige esta versión del formulario: un PDF de muestra solo dice
      el período de la declaración, no desde cuándo rige el formulario
