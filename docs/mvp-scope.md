# Alcance del MVP

**Impuesto:** IVA únicamente. **Periodicidad:** solo mensual (formulario 104).
**Objetivo:** que un usuario cargue sus archivos del SRI y obtenga, en minutos,
los valores que debe ingresar en cada casillero del formulario 104 del período.

El formulario es el **destino** de los resultados, no una fuente de cálculo
([ADR-015](adr/015-definicion-del-formulario-desde-pdf.md)).

---

## Dentro del alcance

### 1. Cuentas y contribuyentes

- Registro y autenticación con correo y contraseña.
- Dos roles: `INDIVIDUAL` (1 contribuyente) y `ACCOUNTANT` (N según plan).
  El rol es cambiable — ver [ADR-003](adr/003-usuario-como-tenant-con-tabla-de-union.md).
- Alta de contribuyentes con RUC, razón social, régimen, periodicidad de IVA y
  actividades económicas. **Régimen y periodicidad los ingresa el usuario tal como
  se los asignó el SRI**, y son editables.
- Un contribuyente con periodicidad semestral puede registrarse, pero el MVP no
  genera su pre-declaración y lo indica con claridad: el semestral es otro
  formulario y está fuera del alcance.
- Selector de contribuyente para el rol `ACCOUNTANT`. Oculto para `INDIVIDUAL`.

**Criterio de aceptación:** un usuario `ACCOUNTANT` con 3 contribuyentes cambia
entre ellos y nunca ve datos de un contribuyente que no tiene asignado, ni siquiera
forzando identificadores en la URL.

### 2. Ingesta

- Carga de archivos `.txt` separados por tabulación del portal del SRI:
  comprobantes **recibidos** (compras) y **emitidos** (ventas).
- **Carga múltiple**: el SRI permite consultar por día, así que un período puede
  requerir decenas de archivos. La pantalla acepta varios a la vez y permite
  agregar más a un período ya iniciado.
- Validación por fila:
  - La `CLAVE_ACCESO` es consistente con fecha, tipo, RUC y serie
    ([ADR-009](adr/009-clave-de-acceso-como-clave-de-deduplicacion.md)).
  - El contribuyente del archivo coincide con el contribuyente seleccionado.
  - La fecha de emisión cae dentro del período.
  - El tipo de comprobante está en la lista blanca
    ([ADR-010](adr/010-tratamiento-por-tipo-de-comprobante.md)).
- Deduplicación por `CLAVE_ACCESO`. Resubir un archivo no duplica nada.
- Archivos con solo encabezado (días sin movimiento) se aceptan sin error.

**Criterio de aceptación:** cargar los mismos 30 archivos dos veces deja
exactamente el mismo número de comprobantes que cargarlos una vez.

### 3. Clasificación de compras

Cascada de cuatro niveles ([ADR-005](adr/005-clasificacion-en-cascada.md)):

1. Regla aprendida para ese contribuyente y proveedor.
2. Catálogo compartido de proveedores.
3. IA — **opcional, desactivable por cuenta** ([ADR-007](adr/007-modo-sin-ia-y-catalogo-compartido.md)).
4. Bandeja de revisión manual.

Solo entran a la cascada los comprobantes con `IVA > 0`. Los de `IVA = 0` van a un
bucket agregado sin decisión por factura ([ADR-008](adr/008-solo-totales-sin-detalle-de-lineas.md)).

**Criterio de aceptación:** al reclasificar manualmente un proveedor, el siguiente
período clasifica ese proveedor automáticamente y sin consultar a la IA.

### 4. Bandeja de conciliación

Tres estados visibles, con acciones masivas:

1. Con derecho a crédito tributario.
2. Como costo o gasto.
3. Pendientes de revisión.

Toda decisión escribe una regla y un evento en la bitácora inmutable
([ADR-013](adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md)).

### 5. Ventas emitidas y factor de proporcionalidad

**Marcado de ventas.** Tras cargar los comprobantes emitidos, el sistema los muestra
en una tabla. Las ventas con `IVA > 0` se asignan solas (ventas gravadas). Las de
`IVA = 0` las marca el usuario, una por una o en bloque, con su destino:
exportación de servicios, exportación de bienes, 0% con derecho a crédito, 0% sin
derecho, o no objeto / exento. El archivo no trae al cliente ni el concepto, así que
no hay forma de inferirlo. Cada marca queda en la bitácora.

**Factor.** El sistema lo calcula con su propia lógica de dominio a partir de esas
ventas. Exportaciones y ventas 0% con derecho a crédito cuentan como ventas que dan
derecho a crédito: un contribuyente que solo exporta servicios tiene factor
`1.0000`. Detalle en [`tax/formulario-104.md`](tax/formulario-104.md).

- **No se calcula mientras haya ventas con `IVA = 0` sin marcar.** Un factor sobre
  ventas sin clasificar sería un número con apariencia de exacto.
- El sistema explica en texto qué factor obtuvo y por qué, en vez de mostrar solo un
  número.
- Se almacenan los insumos del cálculo, no solo el resultado.

**Criterio de aceptación:** cambiar la marca de una venta de exportación de servicios
a "0% sin derecho a crédito" cambia el factor, y ese cambio queda registrado con
autor y fecha.

### 6. El sistema conoce el formulario

El formulario es el destino de los resultados. **No interviene en ningún cálculo.** El
sistema lo conoce para poder decir, junto a cada resultado, dónde se ingresa.

- **Importación (administrador).** Se sube el PDF de un formulario ya presentado, una
  vez y de nuevo cuando el SRI lo actualice. El sistema lo lee, **no lo guarda**, y
  conserva el catálogo completo de campos: código, nombre oficial, sección y orden. Los
  valores y los datos personales del PDF se descartan
  ([ADR-015](adr/015-definicion-del-formulario-desde-pdf.md)).
- **Relación automática.** Al calcular una declaración, el sistema relaciona cada
  resultado con el campo que le corresponde, por su significado, y lo presenta con el
  nombre oficial: `Adquisiciones con derecho a crédito tributario (valor bruto) — 500 =
  1,000.00`. Nadie asigna cada resultado a mano. La relación se guarda por versión del
  formulario, así es estable.
- **Explicación.** Cada relación lleva la razón por la que el resultado se ubicó en ese
  casillero, visible para el usuario. Es una aproximación y se presenta como tal.
- **El administrador es del sistema, no de un contribuyente.** Solo importa el formulario
  (y las tasas); no interviene en resultados ni ve datos de contribuyentes.
- **Formulario actualizado.** Se vuelve a subir: el sistema muestra los campos nuevos,
  renombrados o que ya no aparecen, conserva las relaciones que siguen válidas y
  recalcula las demás.
- Los usuarios ven el formulario vigente en modo lectura, y cada período guarda con qué
  versión se presentó el resultado.

**Criterio de aceptación:** importar dos veces el mismo PDF no crea una versión nueva;
ningún dato personal del PDF queda en la base de datos; **cada resultado del MVP obtiene
el casillero esperado** de la tabla de [`tax/formulario-104.md`](tax/formulario-104.md),
con su explicación, sin intervención de nadie; un campo renombrado aparece en el diff antes de
publicar.

### 7. Pre-declaración

- Cada resultado se presenta con su casillero y su nombre oficial:
  `Adquisiciones con derecho a crédito tributario (valor bruto) — 500 = 1,000.00`.
  El usuario copia esos valores en el formulario del período.
- **Solo lo básico de ventas y compras** ([`tax/formulario-104.md`](tax/formulario-104.md)):
  ventas por destino, compras con y sin derecho a crédito (solo `IVA > 0`), y el
  factor con su crédito. No incluye la liquidación, los saldos de crédito de meses
  anteriores ni el total a pagar.
- Las compras con `IVA = 0` no van a un casillero: se muestra su total como dato
  informativo.
- Los resultados dejan listo lo que después sumará a Renta: base de compras e IVA por
  destino, IVA que se vuelve costo, y total de ventas.
- **Trazabilidad**: clic en cualquier casillero abre el detalle de los
  comprobantes que lo componen.
- Encabezado permanente indicando el carácter asistivo del cálculo y que se
  trabaja con totales, no con el detalle de líneas.
- Cierre de período: al marcarlo como declarado, los comprobantes se congelan.

**Criterio de aceptación:** la suma de los comprobantes que muestra el desglose
de un casillero es exactamente el valor del casillero.

---

## Fuera del alcance

| Elemento | Razón | Preparado en el modelo |
|---|---|---|
| Liquidación, saldos de crédito anteriores y total a pagar | El MVP entrega qué poner en ventas y compras | No |
| IVA semestral | Es otro formulario, con casilleros propios | Sí — `form_versions.form_code`, `iva_periodicity` |
| Impuesto a la Renta | Otro motor de reglas, otro formulario | Sí — `tax_periods.tax_type` |
| Retenciones | Ídem | Sí |
| ATS | Alto valor, pero posterior | Parcial |
| Parser de XML | El TXT cubre el caso de uso | Sí — `source_files.kind` |
| Consulta automática al SRI | El SRI no expone una API para esto | No |
| Despachos multiusuario | No hay demanda validada aún | Sí — `user_taxpayers` |
| Facturación y cobros | Posterior a validar el producto | No |
| Inglés | `es` primero | Sí — next-intl desde el inicio |

---

## Fuera del alcance por limitación de la fuente

Estas no son decisiones de producto, son límites de los archivos del SRI. Se
documentan para el usuario en la interfaz, no se resuelven:

- **Sin detalle de líneas.** Los archivos traen totales por comprobante. Una
  factura mixta (gravada y 0%) no se puede desagregar.
- **`IVA = 0` es ambiguo.** No se distingue tarifa 0%, exento y no objeto.
- **Sin concepto ni descripción.** La clasificación se apoya en el proveedor y la
  actividad económica del contribuyente, nada más
  ([ADR-006](adr/006-reglas-por-proveedor-y-actividad-economica.md)).
