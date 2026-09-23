# Reglas para asistentes de IA

Contexto obligatorio antes de escribir código aquí:
[`docs/mvp-scope.md`](docs/mvp-scope.md), [`docs/data-model.md`](docs/data-model.md)
y [`docs/adr/`](docs/adr/).

---

## Reglas duras

**1. `src/domain/` no importa infraestructura.**
Nada de `@prisma/client`, `next`, `fetch` ni acceso a base de datos. Recibe objetos
planos, devuelve veredictos. Si una función de dominio necesita la tasa de IVA, se
le **pasa** como parámetro; no la consulta. ([ADR-001](docs/adr/001-nextjs-monolito-con-capa-de-dominio.md))

**2. Nunca se consulta una tabla protegida fuera del envoltorio de usuario.**
`prisma.invoicesReceived.findMany()` directo **devuelve todo, sin filtrar**.
Compila y funciona, y es el fallo más grave posible en este producto.
Todo acceso pasa por el envoltorio que fija `app.current_user_id`.
([ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md))

**3. El dinero es `Decimal`, nunca `number`.**
`DECIMAL(14,2)` en PostgreSQL, `Prisma.Decimal` en TypeScript. Ninguna operación
monetaria en coma flotante.

**4. No se hardcodean tasas ni casilleros.**
Se consultan por la fecha del hecho. ([ADR-012](docs/adr/012-tasas-y-casilleros-como-datos-con-vigencia.md))

**5. No se derivan valores que la fuente no trae.**
`subtotal` y `vat_amount` son copias fieles del archivo. No se calcula base gravada
ni base 0%. ([ADR-008](docs/adr/008-solo-totales-sin-detalle-de-lineas.md))

**6. Ningún cambio de clasificación sin evento en la bitácora.**
([ADR-013](docs/adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md))

**7. El formulario 104 es el destino de los resultados, no una fuente de cálculo.**
El sistema calcula con su propia lógica y el usuario copia los valores en el portal
del SRI. Ni los valores ni las fórmulas del PDF del formulario alimentan nada; las
fórmulas de [`formulario-104.md`](docs/tax/formulario-104.md) son referencia para
quien implementa el dominio.

**El dominio no conoce números de casillero.** Produce resultados con clave estable y
una descripción estructurada (`SALES_TAXED`, `PURCHASES_WITH_CREDIT`…); el sistema los
relaciona con el catálogo del formulario por su significado y guarda la relación en
`result_mappings`. Nunca escribir `401` o `500` en `src/domain/`.
([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md))

**8. El MVP solo cubre el formulario mensual.** El semestral es otro formulario.

**9. El vocabulario del producto no promete lo que el sistema no hace.**
Nunca "Declarar" ni "Listo para declarar". ([ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md))

---

## Errores fáciles de cometer aquí

| Error | Por qué importa |
|---|---|
| Usar `FECHA_AUTORIZACION` para asignar el período | El período lo determina `FECHA_EMISION` |
| Asumir delimitador coma | Son TXT separados por **tabulación** |
| Asumir dos decimales en el texto de origen | El SRI escribe `4.5`, no `4.50` |
| Excluir notas de crédito del cálculo de IVA | **Restan.** Ignorarlas sobreestima el crédito ([ADR-010](docs/adr/010-tratamiento-por-tipo-de-comprobante.md)) |
| Clasificar comprobantes con `IVA = 0` | No entran a la cascada |
| Clave de regla solo por proveedor | Es `(contribuyente, proveedor, huella de actividad)` ([ADR-006](docs/adr/006-reglas-por-proveedor-y-actividad-economica.md)) |
| Consultar la IA por comprobante | Es **por proveedor** ([ADR-005](docs/adr/005-clasificacion-en-cascada.md)) |
| Enviar RUC o nombre del contribuyente a la IA | Nunca sale del sistema ([ADR-007](docs/adr/007-modo-sin-ia-y-catalogo-compartido.md)) |
| Suponer que ventas sin IVA dan factor cero | **No.** Exportaciones y ventas 0% con derecho a crédito suman al numerador: factor `1.0000` ([`formulario-104.md`](docs/tax/formulario-104.md)) |
| Tratar el factor como un solo número sin contexto | Depende del destino de cada venta con `IVA = 0`, que el archivo no indica |
| Leer, almacenar o ejecutar una fórmula impresa en el PDF del formulario | El formulario es destino, no fuente. La lógica vive en `src/domain/`, escrita y probada ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)) |
| Calcular el factor con ventas `IVA = 0` sin marcar | Bloqueado hasta que el usuario marque el destino de cada una |
| Guardar el PDF del formulario, sus valores o sus fórmulas | Solo se guarda el catálogo de campos (código, nombre, sección). El PDF trae datos personales |
| Hacer que el administrador asigne o corrija resultados | El administrador es **del sistema**, no de un contribuyente: solo importa el formulario. Cada relación se explica; nadie la edita a mano |
| Mostrar un resultado con casillero sin su explicación | Es una aproximación: siempre con el nombre oficial y la razón |
| Bloquear el cálculo porque un resultado no tiene casillero | Se muestra sin código y se avisa; no bloquea |
| Agregar `attribution` (directa / prorrateable) | Se eliminó: la clasificación de una compra es 500 o 502 |
| Repartir las compras con `IVA = 0` entre 507, 508, 531, 532 | No van a casillero; solo un total informativo |
| Ver un casillero ausente en una importación como eliminado | Es "no observado"; solo se retira por acción explícita |
| Reescribir un ADR al cambiar de opinión | Se escribe uno nuevo que lo reemplaza |

---

## Modelos de IA

| Uso | Modelo |
|---|---|
| Clasificación masiva | `claude-haiku-4-5` |
| Escalamiento de casos ambiguos | `claude-opus-5` |

Con salidas estructuradas (`output_config.format`), no parseando prosa. Batch API
para el pase masivo. Toda respuesta registra `model_id` y `prompt_version`.

---

## Verificación antes de tocar el formato del SRI

Antes de escribir o modificar un parser, leer
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).
Ese documento fue verificado contra archivos reales y contiene una lista de
pendientes. **No inventar columnas ni suponer literales** que no estén ahí.

## Valores normativos

Todo número tributario en `docs/tax/` lleva fuente y fecha de verificación. Si
falta, va marcado `[VERIFICAR]` y **no se carga al sistema**. No completar un
`[VERIFICAR]` de memoria.

---

## Al terminar un cambio

Ver [`docs/guides/documentation-checklist.md`](docs/guides/documentation-checklist.md).
