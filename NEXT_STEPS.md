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

## Verificaciones antes de construir

- [x] **Reconciliación código ↔ specs pre-código (2026-09-30).** El esquema,
      el enrutado, el estilo y el idioma ya siguen `docs/data-model.md`,
      `docs/site/screens/*.md` y `docs/guides/coding-guidelines.md`: UUID
      nativo `uuidv7()` (PostgreSQL 18) con columnas `snake_case` vía `@map`;
      tablas `plans`/`ai_usage` y los campos que faltaban; rutas
      `/[locale]/(app)/[taxpayerId]/periodos/[periodId]/...` con Server
      Actions (no más API routes REST); Tailwind 4 + shadcn/ui en vez de
      estilos inline; texto en español vía `next-intl`
      (`messages/es.json`), sin literales en los componentes.
      **Se descartó una parte del spec en vez de seguirla:**
      `docs/guides/coding-guidelines.md` pide SQL crudo para el factor de
      proporcionalidad y los totales por casillero; el dominio ya los
      calcula en TypeScript puro sobre `Decimal.js`
      (`src/domain/iva/calculator.ts`, `proportionality.ts`), que es lo que
      ADR-001 pide para poder probar el motor sin base de datos. La guía
      quedó sin corregir — antes de tocarla, decidir si de verdad se quiere
      mover esa lógica a SQL o si la guía es la que está desactualizada.
- [x] **`SALES_NON_OBJECT_EXEMPT` no se calculaba.** `NON_OBJECT_EXEMPT`
      (431/441) era un destino marcable sin resultado correspondiente en
      `calculator.ts`/`RESULT_KEYS`. Agregado.
- [x] **Prueba de RLS.** Verificado manualmente end-to-end contra la base real,
      dos veces (antes y después de reconstruir el esquema): dos usuarios, dos
      contribuyentes, ninguno ve datos del otro; una consulta sin `withUser()`
      no ve nada. Se encontraron y corrigieron tres fallos reales en total,
      ninguno con error visible:
      1. Las políticas referenciaban columnas `snake_case` que no existían
         (el esquema no tenía `@map`).
      2. Faltaba `FORCE ROW LEVEL SECURITY`, así que el rol `taxap` —dueño de
         las tablas por correr las migraciones— quedaba exento de sus propias
         políticas.
      3. El propio ejemplo de ADR-004 usa un *bypass* cuando la variable de
         sesión está simplemente sin fijar — indistinguible de una consulta
         que alguien olvidó envolver en `withUser()`. Corregido con un id
         centinela explícito que `asAdmin()` debe fijar a propósito (ver nota
         de actualización en el propio ADR-004).
      Estado actual en `prisma/migrations/*_add_rls/`. Ver
      [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md) y CLAUDE.md →
      "Errores fáciles de cometer aquí".
      **Pendiente real:** sigue sin existir un test de regresión permanente —
      cada verificación fue ad hoc y se descartó. Escribir uno (`tests/rls/`
      según `docs/guides/coding-guidelines.md`) antes de tocar
      `src/lib/db.ts` de nuevo.
- [x] **`file-parser.ts` no coincidía con el formato verificado.** Tenía
      columnas inventadas (`DESCUENTO`, `ESTADO`, `NUMERO_COMPROBANTE`) que no
      están en `docs/tax/formato-archivos-sri.md`, y le faltaba
      `RAZON_SOCIAL_EMISOR` — la "señal principal de clasificación" según ese
      mismo documento. También se encontraron dos bugs reales derivados:
      `ingestion-service.ts` pasaba `SERIE` (recibidas) y `COMPROBANTE`
      (emitidas, que es el *tipo* de comprobante, no la serie) donde
      correspondía `SERIE_COMPROBANTE`, y `parseDate` no recortaba la hora
      que trae `FECHA_EMISION` en el archivo de emitidas, produciendo fechas
      inválidas silenciosamente. Corregido; ver CLAUDE.md → "Errores fáciles
      de cometer aquí".
- [ ] **Autenticación no está conectada.** Cada `actions.ts` nuevo tiene un
      `getCurrentUserId()` que lanza `Error('Auth not wired up yet')` — a
      propósito, para que falle ruidosamente en vez de simular un usuario
      falso. Bloquea probar cualquier pantalla de principio a fin.
- [ ] **No hay pantalla de alta de contribuyente ni de selección de período.**
      `docs/site/screens/README.md` las deja fuera de esta ronda a propósito.
      Mientras tanto, la portada enlaza a un `taxpayerId`/`periodId` de
      relleno (`/demo/periodos/demo/...`) que no existe en la base.
- [ ] **Pantalla `admin-formulario.md` no construida.** Sigue siendo solo el
      spec; nadie ha importado un formulario todavía.
- [ ] **Bloqueo de período (ADR-013, segundo mecanismo) sin disparador.** Se
      implementó el disparador de inmutabilidad de `classification_events`,
      pero no el que debería rechazar modificaciones a comprobantes de un
      `tax_period` con `locked_at` fijado. `lockPeriod()` marca el período
      como `FILED` pero nada en la base impide editar sus comprobantes
      todavía.
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
