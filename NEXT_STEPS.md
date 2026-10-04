# Pendientes

Lo ya resuelto vive en [`CHANGELOG.md`](CHANGELOG.md), no aquí.

## Decisiones abiertas

**Dónde desplegar.** DigitalOcean es la opción principal por experiencia previa
(droplet + Docker + Caddy + Terraform + Cloudflare, patrón de
`comprobify-web/docs/adr/008`). No se decide hasta tener algo que desplegar.
Advertencia registrada de ese proyecto: **el droplet más barato se quedó corto
para Next.js con Prisma.** Arrancar al menos un nivel arriba.

**Almacenamiento de archivos originales.** Guardar los `.txt` cargados permite
reprocesar sin pedirlos de nuevo. Filesystem en local; en producción, almacenamiento
compatible con S3. Sin decidir si se guardan indefinidamente.

**Términos y condiciones.** [ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md)
fija la postura de producto. El texto legal necesita revisión profesional antes de
abrir a usuarios reales.

## Por construir

- [ ] **Extracción automática del PDF del formulario** (ADR-015, paso
      "Subir PDF → extraer"). Las pantallas de administración
      (`/admin/formularios`) existen desde el 2026-10-04, pero el PDF solo
      se usa para calcular su `sha256` -- cada casillero se ingresa a mano
      después de subirlo. No hay parser de la capa de texto todavía.
- [ ] **Cálculo de `result_mappings`** (ADR-015, la cascada de 4 niveles:
      versión anterior → coincidencia por atributos → IA → sin
      casillero). Hoy un admin puede publicar un `form_version` con sus
      `form_fields`, pero nada construye la relación resultado→casillero
      todavía -- la pre-declaración sigue mostrando solo las claves del
      dominio.
- [ ] **Test de regresión de RLS.** Se ha verificado manualmente contra la
      base real varias veces, pero no queda como artefacto reproducible
      (`tests/rls/`, según `docs/guides/coding-guidelines.md`). Escribir uno
      antes de tocar `src/lib/db.ts` de nuevo.
- [ ] **Medir el paso de clasificación** con un período real y muchos
      proveedores nuevos. Si no cabe en una petición HTTP, entra pg-boss
      ([ADR-011](docs/adr/011-ingesta-y-clasificacion-en-dos-pasos.md)).

## Verificación normativa pendiente

Nada de esto se resuelve con código — requiere archivos reales del SRI,
revisar el portal, o confirmar una fecha de vigencia:

- [ ] **Completar `docs/tax/formato-archivos-sri.md`** con archivos que
      incluyan notas de crédito, notas de débito y comprobantes de retención.
- [ ] **Verificar y cargar `tax_rates`.** La pantalla (`/admin/tasas`)
      existe desde el 2026-10-04 y no deja guardar nada sin fuente y
      fecha de verificación -- falta la verificación en sí
      (`docs/tax/tasas-iva.md`: ninguna tasa confirmada todavía).
- [ ] **Verificar con el portal** si 563/564/565 y los totales (409/419/429,
      509/519/529) los calcula el portal a partir de lo ingresado
      ([`docs/tax/formulario-104.md`](docs/tax/formulario-104.md) → *Pendiente
      de verificar*). Incluye qué espera el portal cuando el denominador del
      factor es cero (el dominio ya bloquea ese caso con una razón explícita;
      lo que falta es si el portal necesita algo tecleado de todas formas).
- [ ] **Probar el emparejamiento contra el formulario real** antes de
      construir sobre él: que cada resultado del MVP caiga en el casillero
      esperado de [`formulario-104.md`](docs/tax/formulario-104.md). Es el
      riesgo principal de
      [ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md): un
      valor correcto junto al casillero incorrecto.
- [ ] **Sanitizar el PDF de muestra** para usarlo como fixture de pruebas del
      parser ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)).
      El original trae datos personales y no se versiona.
- [ ] **Verificar con un archivo real** si los comprobantes de retención
      recibidos alimentan el casillero 609.

## Fuera del MVP

### Impuestos
- **Impuesto a la Renta.** El modelo de gastos personales cambió: es una **rebaja**
  calculada sobre canasta familiar básica y cargas, con más categorías que las dos
  de la definición inicial. Requiere verificación normativa completa.
- **Retenciones.**
- **ATS.** Probablemente el mayor gancho comercial después del IVA: es trabajo
  mensual doloroso y el modelo de datos ya contiene casi todo lo necesario.

### Producto
- **Liquidación y saldos.** Casilleros 480–499 y 601–999: liquidación del mes, saldos de
  crédito de meses anteriores (605 ← 615 del período previo), total a pagar. Requieren
  un mecanismo de arrastre entre períodos o de ingreso manual.
- **Compras con `IVA = 0` con casillero definitivo** (507, 508, 531, 532). Hoy solo hay
  un total informativo con un casillero aproximado sugerido.
- **Activos fijos** (402, 501…): el archivo del SRI no los distingue.
- **IVA semestral.** Es otro formulario (probablemente el 104A `[VERIFICAR]`), con
  casilleros propios. Hace falta una muestra para importar su definición
  ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)); la estructura ya
  lo admite. Mientras tanto un contribuyente semestral puede registrarse, pero el MVP
  no genera su pre-declaración.
- Despachos con varios usuarios. La estructura ya lo soporta
  ([ADR-003](docs/adr/003-usuario-como-tenant-con-tabla-de-union.md)); falta
  interfaz de invitación y gestión de permisos.
- Facturación y cobro de suscripciones.
- Comparativa entre períodos, para detectar variaciones anómalas.
- Exportación a Excel o PDF del borrador.
- Inglés. `next-intl` está desde el inicio; falta `messages/en.json`.

### Técnico
- Ingesta de XML de comprobantes, que sí trae detalle de líneas. Convivirá con el
  TXT a distinta precisión ([ADR-008](docs/adr/008-solo-totales-sin-detalle-de-lineas.md)).
- Política de archivado de `classification_events`.
- Alerta cuando un período usa una vigencia normativa vencida.
- Bloqueo consultivo por período para evitar clasificación concurrente.
