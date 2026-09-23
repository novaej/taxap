# ADR-015: El sistema conoce el formulario y relaciona cada resultado con su casillero

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

taxap calcula valores que el usuario luego **ingresa** en el formulario 104 del
período, en el portal del SRI. El formulario es el destino de esos resultados, no una
fuente de cálculo.

Al calcular la declaración de un contribuyente, cada resultado tiene que poder decir
dónde va. Si el cálculo da que 1.000 son compras con derecho a crédito, o que 200 son
un monto sin IVA, el sistema tiene que saber **aproximadamente** a qué campo del
formulario corresponden, y mostrarlo así:

```
Adquisiciones con derecho a crédito tributario (valor bruto) — 500 = 1,000.00
```

Para eso el sistema necesita conocer el formulario completo: qué campos existen, con
qué nombre oficial y en qué casillero. El formulario tiene más de doscientos y el SRI
puede cambiarlo. Hay tres formas malas de resolverlo:

- **Transcribirlo a mano**: un casillero mal numerado manda un total al campo
  equivocado sin que nada falle, y no hay camino de actualización.
- **Escribir el número de casillero en el código** (`SALES_TAXED → 401`): cada cambio
  del SRI exige un despliegue y se pierde qué casillero regía en un período pasado.
- **Guardar el PDF**: contiene la declaración de una persona real.

Un formulario ya presentado, descargado del portal, contiene toda la estructura. Al
examinar uno real se verificó que tiene **capa de texto** (se lee sin OCR), que las
filas siguen patrones regulares (ternas bruto / neto / impuesto), y que algunas
descripciones se parten en varias líneas o continúan en la página siguiente (el
casillero 603).

## Decisión

### 0. El formulario no es un insumo del cálculo

Todo cálculo vive en `src/domain/` y parte de los comprobantes y de lo que el usuario
marca. Ni los valores del PDF ni las fórmulas que imprime alimentan el sistema. Las
fórmulas se transcriben en [`formulario-104.md`](../tax/formulario-104.md) solo como
referencia para quien implementa el dominio. Tampoco se usa el formulario para
comparar ni validar resultados: su función es ser el lugar donde se copian.

### 1. El administrador sube el formulario una vez; el sistema guarda su catálogo completo

Se sube un PDF de un formulario ya presentado, y se vuelve a subir cuando el SRI lo
actualiza. El sistema lo lee y guarda **todos los campos**: código de casillero, nombre
oficial, sección, tipo de columna y orden.

**Se guarda la estructura y nada más.** Los valores, las fórmulas y los datos personales
(identificación, razón social, serial, código verificador, fechas de recaudación) no se
extraen ni se persisten, y **el PDF original no se guarda**. Se conserva su `sha256`
para poder comprobar que un archivo dado produjo una versión dada.

**Extracción determinista.** Se lee la capa de texto y se interpreta con código. Un PDF
sin capa de texto (escaneado) se rechaza.

### 2. El sistema relaciona cada resultado con un campo, por significado

El dominio produce **resultados con clave estable** (`SALES_TAXED`,
`PURCHASES_WITH_CREDIT`, `PROPORTIONALITY_FACTOR`…) y **no conoce números de casillero**.
Cada resultado lleva una **descripción estructurada** de qué es:

| Atributo | Ejemplo |
|---|---|
| Operación | venta / compra |
| Tratamiento | gravado, 0% con derecho a crédito, exportación de servicios, sin derecho a crédito… |
| Columna | bruto / neto / impuesto |
| Activo fijo | no |

El sistema compara esa descripción con los nombres oficiales del catálogo y **sugiere el
campo más cercano**. Nadie asigna cada resultado a mano. La relación es aproximada por
naturaleza, así que se resuelve en cascada, igual que la clasificación de compras
([ADR-005](005-clasificacion-en-cascada.md)):

| Nivel | Mecanismo | Determinista |
|---|---|---|
| 1 | Relación ya guardada para esa versión del formulario | Sí |
| 2 | Coincidencia por atributos contra los nombres y la posición de los campos | Sí |
| 3 | IA — **opcional**; recibe solo nombres de campos y descripciones de resultados | No |
| 4 | Sin coincidencia: el resultado se muestra sin casillero y se avisa | — |

**La relación se calcula una vez por versión de formulario y se guarda**, de modo que un
mismo resultado siempre cae en el mismo casillero para todos los usuarios y un período
pasado se reexplica igual. Lo que envía la IA en el nivel 3 es estructura pura: nada de
contribuyentes, comprobantes ni valores.

### 3. La relación es aproximada, y se explica

La relación es una **aproximación** ([ADR-014](014-caracter-asistivo-y-disclaimers.md)) y
se presenta como tal. Cada resultado se muestra con el **nombre oficial del campo** junto
al valor, y con **la razón por la que se ubicó ahí**:

```
Adquisiciones con derecho a crédito tributario (valor bruto) — 500 = 1,000.00
  ¿Por qué aquí? Son compras con IVA y con derecho a crédito tributario, y el campo 500
  se llama «Adquisiciones y pagos … gravados tarifa diferente de cero (con derecho a
  crédito tributario)», columna valor bruto.
```

La explicación se guarda junto a la relación (`reason`). En el nivel 2 sale de una plantilla
con la descripción del resultado y el nombre del campo; en el nivel 3, del razonamiento
breve que devuelve la IA.

**Nadie corrige las relaciones a mano.** El administrador es el **administrador del
sistema**, no de un contribuyente: sube el formulario y no interviene en resultados ni ve
datos de contribuyentes. Quien lee la declaración tiene el nombre oficial y la razón para
juzgar si el lugar es razonable. Una relación equivocada se corrige mejorando las reglas de
emparejamiento en el código, con una prueba que la cubra, o con una versión nueva del
formulario.

### 4. Flujo de importación

```
Subir PDF → extraer → validar → comparar con el catálogo vigente → publicar
```

**Validación estructural.** Códigos únicos; todo campo tiene nombre; las ternas siguen el
patrón numérico esperado. Una violación detiene la importación con el detalle.

**Comparación.** Contra la versión vigente: campos nuevos, renombrados y que ya no
aparecen. Las relaciones guardadas cuyo campo no cambió se conservan; las que apuntaban
a un campo modificado se recalculan para la versión nueva. El administrador revisa antes
de publicar.

**La vigencia la fija el administrador.** Un PDF de muestra dice el período de esa
declaración, no desde cuándo rige esa versión del formulario. `valid_from` se ingresa
explícitamente.

**Ausencia no es eliminación.** Un formulario puede omitir secciones según el tipo de
contribuyente. Un campo que no aparece en un PDF nuevo se marca **no observado** y se
avisa; solo se retira por acción explícita.

### 5. Versiones inmutables y trazables

Una versión usada por algún período no se modifica. Cada `tax_periods` guarda el
`form_version_id` con el que se presentó el resultado, así un período pasado siempre se
puede reexplicar con el formulario que regía entonces.

### 6. Un formulario por código; el MVP solo cubre el mensual

La versión se identifica por `form_code`. **El MVP soporta únicamente el formulario 104
mensual.** El semestral es otro formulario y queda fuera; la misma importación servirá
para él cuando se incorpore.

## Consecuencias

### Positivas
- El sistema sabe dónde va cada resultado sin que alguien lo asigne uno por uno, y sigue
  sabiéndolo cuando el SRI cambia el formulario: se sube el PDF nuevo y se revisa el
  diff.
- El código no depende de la numeración del SRI.
- Un período pasado sabe con qué formulario se presentó, y la relación guardada lo hace
  reproducible.
- No se retiene el PDF ni datos personales; lo guardado (códigos y nombres) no identifica
  a nadie.
- Como el formulario no interviene en el cálculo, un error de lectura o de relación puede
  mostrar un valor en el campo equivocado, pero **no puede producir un valor incorrecto**.

### Negativas
- **Una relación aproximada puede equivocarse.** Es el fallo que más importa: un valor
  correcto que aparece junto al casillero incorrecto, sin que nada falle. Es más probable
  que con una asignación manual. Mitigaciones: la cascada empieza por lo determinista, la
  relación se guarda y es estable, y el nombre oficial y la razón van siempre junto al
  valor. **El conjunto de resultados del MVP con su casillero
  esperado ([`formulario-104.md`](../tax/formulario-104.md)) debe usarse como pruebas del
  emparejamiento**, para detectar que un cambio de formulario o de reglas rompe una
  relación conocida.
- **Sin corrección manual, una relación equivocada persiste** hasta que se cambien las
  reglas de emparejamiento o llegue una versión nueva del formulario. Es la contrapartida
  de que nadie asigne nada a mano, y lo que hace importante el conjunto de pruebas.
- Los nombres del SRI pueden reformularse sin cambiar el casillero, y entonces el
  emparejamiento por nombre pierde la relación aunque el campo siga siendo el mismo. El
  diff lo detecta, pero hay que revisarlo en cada actualización.
- **El parser es la parte frágil.** Las descripciones partidas y la continuación entre
  páginas complican el orden del texto extraído. Necesita pruebas con casos reales.
- **Las pruebas necesitan un PDF de muestra y el real no se puede versionar.** Hay que
  generar uno sanitizado o sintético.
- Una sola muestra ofrece una sola vista del formulario. Si hay secciones condicionales,
  puede faltar algún campo; se resuelve con otra importación.

## Alternativas consideradas

**Que el administrador asigne o corrija cada resultado.** Da máxima certeza sobre cada
relación. Descartada: el objetivo es que el sistema conozca el formulario y sepa a dónde
va cada resultado sin ese paso manual, y el administrador es del sistema, no de los
contribuyentes: no le corresponde intervenir en los resultados de nadie.

**Guardar solo los campos que se usan.** Ahorra espacio. Descartada: el sistema necesita
el catálogo completo para poder relacionar resultados nuevos sin volver a subir el PDF.

**Números de casillero en el código.** Simple y con verificación de tipos. Descartada:
cada cambio del SRI es un despliegue y se pierde la trazabilidad por período.

**Tabla sembrada a mano.** Sin parser. Descartada: propensa a errores en el dato más
crítico del producto y sin camino de actualización.

**Extraer el PDF con IA de visión.** Toleraría cualquier maquetación. Descartada: enviaría
un documento con datos personales a un tercero y un número de casillero mal leído es un
error silencioso. La IA solo interviene, de forma opcional, para emparejar sobre
estructura sin datos.

**Guardar el PDF original.** Descartada: es un pasivo de privacidad, y el `sha256` cubre
la necesidad de trazabilidad.

**Una fuente estructurada oficial** publicada por el SRI. Sería lo ideal, pero no se
identificó una `[VERIFICAR]`. Si existe, este ADR se reemplaza.
