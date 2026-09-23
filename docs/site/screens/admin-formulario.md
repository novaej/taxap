# Administración del formulario

**Ruta:** `/admin/formularios`
**Server Actions:** `importFormPdf`, `publishFormVersion`
**Capas:** `app/` (fuera de `[taxpayerId]`) → `services/form-import` (extracción de PDF, sin RLS — no es dato de contribuyente) → `domain/` (reglas de emparejamiento, nivel 2 de la cascada) → `lib/ai` (nivel 3, opcional) → `lib/db`

---

## Acceso

Rol `ADMIN` únicamente. **El administrador es del sistema, no de un contribuyente**:
esta pantalla no muestra datos de ningún contribuyente y no participa en el cálculo
de ninguna declaración ([ADR-015](../../adr/015-definicion-del-formulario-desde-pdf.md)).

---

## Propósito

Mantener el catálogo de campos del formulario 104 actualizado, para que el sistema
pueda relacionar cada resultado con su casillero
([`../../tax/formulario-104.md`](../../tax/formulario-104.md)). Se usa una vez al
adoptar una versión del formulario, y de nuevo cuando el SRI lo cambia.

---

## Layout — lista de versiones

```
┌──────────────────────────────────────────────────────────────────┐
│  Formularios                              [ + Importar PDF ]      │
├──────────────────────────────────────────────────────────────────┤
│ Código │ Vigente desde │ Estado     │ Campos │ Resultados sin ⚠  │
│  104   │  01/01/2024   │ Publicado  │  187   │        0           │
│  104   │  —  (borrador)│ Borrador   │  190   │        1           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Layout — importar / revisar

```
┌──────────────────────────────────────────────────────────────────┐
│  Importar formulario                                               │
├──────────────────────────────────────────────────────────────────┤
│  [ Arrastre el PDF de un formulario ya presentado ]                │
│  El archivo no se guarda. Solo se conserva su estructura:          │
│  código, nombre y sección de cada campo.                           │
├──────────────────────────────────────────────────────────────────┤
│  Leído: 190 campos en 6 páginas                                    │
│                                                                     │
│  Comparación con la versión vigente (01/01/2024):                  │
│  · 187 campos sin cambio                                           │
│  · 2 campos con nombre distinto     [ ver ]                        │
│  · 1 campo nuevo: 445               [ ver ]                        │
│  · 0 campos ya no presentes                                        │
├──────────────────────────────────────────────────────────────────┤
│  Resultados del sistema y su casillero en esta versión:            │
│                                                                     │
│  PURCHASES_WITH_CREDIT.GROSS → 500                                 │
│    Adquisiciones y pagos … (con derecho a crédito tributario)      │
│    Coincidencia por atributos                                       │
│  SALES_TAXED.GROSS → 401                                           │
│    Ventas locales … gravadas tarifa diferente de cero               │
│    Coincidencia por atributos                                       │
│  PROPORTIONALITY_FACTOR → 563                                      │
│    Factor de proporcionalidad para crédito tributario               │
│    Coincidencia por atributos                                       │
│  EXPORT_SERVICES.GROSS → ⚠ sin campo encontrado                    │
│                                                                     │
├──────────────────────────────────────────────────────────────────┤
│  Vigente desde: [ 01/01/2027 ▾ ]                                   │
│                                                                     │
│           [ Cancelar ]              [ Publicar esta versión ]      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Comportamiento

### Lectura del PDF

1. Se sube el archivo. Si no tiene capa de texto (PDF escaneado), se rechaza con un
   mensaje explícito — no hay respaldo de IA para este paso
   ([ADR-015](../../adr/015-definicion-del-formulario-desde-pdf.md)).
2. Se extrae únicamente código, nombre, sección y tipo de columna de cada campo. Los
   valores, fórmulas y datos personales del PDF (identificación, razón social,
   serial, código verificador) se descartan en el momento.
3. Se calcula `sha256` del archivo para registro; **el PDF no se guarda**.

### Comparación

Contra la versión vigente, sobre los campos por código: sin cambio, renombrado,
nuevo, o ausente en el PDF actual (posible sección condicional, no necesariamente
eliminado).

### Relación con los resultados

Para cada resultado del dominio, el sistema ejecuta la cascada de emparejamiento
([ADR-015](../../adr/015-definicion-del-formulario-desde-pdf.md)): relación ya
guardada para un campo que no cambió → coincidencia por atributos → IA (si está
habilitada) → sin casillero. Cada línea muestra el método usado y, al pasar el
cursor o expandir, la razón completa que se guardará junto al resultado.

**No hay edición manual de estas relaciones.** El administrador revisa el listado;
si algo no coincide, la corrección va en las reglas de emparejamiento del código, no
en esta pantalla.

### Publicar

Requiere fijar `valid_from`. Al publicar:

- Se crea la versión con estado `PUBLISHED`.
- Las relaciones calculadas quedan guardadas para esa versión.
- La versión anterior sigue existiendo, sin modificarse, para los períodos que ya la
  usaron.

---

## Criterios de aceptación

- Importar el mismo PDF dos veces no crea una versión nueva innecesaria (se detecta
  por `sha256`).
- Ningún dato personal ni valor del PDF queda en la base de datos tras la
  importación.
- Un resultado del conjunto del MVP que no encuentra campo se señala antes de
  publicar, no se descubre después en Pre-declaración.
- Una versión publicada y usada por algún período no se puede editar ni eliminar.
