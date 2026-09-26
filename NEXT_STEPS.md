# Pendientes

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

**El código construido diverge de los specs pre-código.** `docs/data-model.md`,
`docs/mvp-scope.md`, `docs/guides/code-flow.md`, `docs/guides/coding-guidelines.md`
y `docs/site/screens/*.md` describen un diseño más elaborado que lo que hay hoy en
`src/`: UUID v7 y columnas `snake_case` vs. `cuid()` y `camelCase` sin `@map`; tablas
`plans` y `ai_usage` y campos como `trade_name`, `ai_enabled`, `classification_source`
que no existen en `prisma/schema.prisma`; rutas `/[locale]/(app)/[taxpayerId]/...` con
Server Actions y `next-intl` vs. rutas planas (`/ingesta`, `/ventas`…) con API routes
REST y texto en inglés sin `next-intl` instalado; Tailwind + shadcn/ui vs. estilos
inline. Las pantallas construidas (`src/app/{ingesta,ventas,conciliacion,
predeclaracion}/`) son maquetas con datos de prueba, no implementaciones fieles de
los specs — así que la regla de `docs/site/screens/README.md` ("al construir la
pantalla, el spec se actualiza para reflejar lo real") todavía no aplicó de verdad.
**Sin decidir:** si el código se corrige para seguir los specs, o los specs se
actualizan para reflejar lo construido, o ambos se reconcilian a propósito antes de
seguir. No tocar ninguno de los dos lados sin decidir esto primero.

## Verificaciones antes de construir

- [ ] **`SALES_NON_OBJECT_EXEMPT` no se calcula.** `NON_OBJECT_EXEMPT` (431/441,
      "no objeto o exenta") existe como destino que el usuario puede marcar
      ([`SalesTreatment`](prisma/schema.prisma), pantalla de ventas emitidas,
      [`formulario-104.md`](docs/tax/formulario-104.md) → tabla de resultados del
      MVP), pero `src/domain/iva/calculator.ts` y `RESULT_KEYS` en
      `src/domain/types.ts` no producen ese resultado. Una venta marcada así
      desaparece de `period_results` sin aviso — no aparece en pre-declaración ni
      cuenta en ningún total.
- [x] **Prueba de RLS.** Verificado manualmente end-to-end contra la base real:
      dos usuarios, dos contribuyentes, ninguno ve datos del otro; una consulta
      sin `withUser()` no ve nada. La migración de RLS tenía dos fallos reales
      hasta esta verificación — ninguno producía error, ambos dejaban el
      aislamiento roto en silencio: (1) las políticas referenciaban columnas
      `snake_case` que no existen (el esquema no tiene `@map`, las columnas son
      `camelCase`); (2) faltaba `FORCE ROW LEVEL SECURITY` en cada tabla, así que
      el rol `taxap` —dueño de las tablas por correr las migraciones— quedaba
      exento de sus propias políticas. Corregido en
      `prisma/migrations/20260924062837_add_rls/`. Ver
      [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md) y CLAUDE.md → "Errores
      fáciles de cometer aquí".
      **Pendiente real:** no quedó un test de regresión permanente — la
      verificación fue ad hoc y se descartó. Escribir uno
      (`tests/rls/` según `docs/guides/coding-guidelines.md`) antes de tocar
      `src/lib/db.ts` de nuevo.
- [ ] **Medir el paso de clasificación** con un período real y muchos proveedores
      nuevos. Si no cabe en una petición HTTP, entra pg-boss.
      ([ADR-011](docs/adr/011-ingesta-y-clasificacion-en-dos-pasos.md))
- [ ] **Completar `docs/tax/formato-archivos-sri.md`** con archivos que incluyan
      notas de crédito, notas de débito y comprobantes de retención.
- [ ] **Verificar y cargar `tax_rates`** con fechas de vigencia y fuente.
- [ ] **Verificar con el portal** si 563/564/565 y los totales (409/419/429,
      509/519/529) los calcula el portal a partir de lo ingresado
      ([`docs/tax/formulario-104.md`](docs/tax/formulario-104.md) → *Pendiente de
      verificar*). Define si el sistema los entrega como valor a teclear o solo como
      contraste.
- [ ] **Definir el factor cuando no hay ventas** (denominador cero).
- [ ] **Probar el emparejamiento contra el formulario real** antes de construir sobre él:
      que cada resultado del MVP caiga en el casillero esperado de
      [`formulario-104.md`](docs/tax/formulario-104.md). Es el riesgo principal de
      [ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md): un valor correcto
      junto al casillero incorrecto.
- [ ] **Sanitizar el PDF de muestra** para usarlo como fixture de pruebas del parser
      ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)). El original
      trae datos personales y no se versiona.
- [ ] **Verificar con un archivo real** si los comprobantes de retención recibidos
      alimentan el casillero 609.

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
- Inglés. `next-intl` está desde el inicio; faltan los mensajes.

### Técnico
- Ingesta de XML de comprobantes, que sí trae detalle de líneas. Convivirá con el
  TXT a distinta precisión ([ADR-008](docs/adr/008-solo-totales-sin-detalle-de-lineas.md)).
- Política de archivado de `classification_events`.
- Alerta cuando un período usa una vigencia normativa vencida.
- Bloqueo consultivo por período para evitar clasificación concurrente.
