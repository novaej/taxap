# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Modo imperativo: "Agregar", no "Agregado".

## [Sin publicar]

### Agregado
- `docs/site/screens/`: especificaciones de ingesta, ventas emitidas, conciliación,
  pre-declaración y administración del formulario — el contrato de cada pantalla
  antes de construirla
- Base documental del proyecto: README, GETTING_STARTED, CLAUDE.md, NEXT_STEPS
- 14 ADRs con las decisiones de arquitectura del MVP
- `docs/mvp-scope.md` con alcance y criterios de aceptación
- `docs/data-model.md` con el esquema comentado
- `docs/tax/formato-archivos-sri.md` verificado contra archivos reales del SRI
- `docs/tax/tasas-iva.md` y `docs/tax/formulario-104.md` como andamiaje pendiente
  de verificación normativa
- ADR-015: el sistema conoce el formulario 104 (catálogo completo importado desde un PDF
  que no se guarda) y relaciona cada resultado con su casillero por significado
- `docs/tax/formulario-104.md`: catálogo de casilleros verificado contra un formulario
  real, con los resultados del MVP y el casillero esperado de cada uno
- Tablas `form_versions`, `form_fields`, `result_mappings` y `period_results` en el
  modelo de datos

### Cambiado
- **El formulario 104 es el destino de los resultados, no una fuente de cálculo.** El
  dominio produce resultados con clave estable y no conoce números de casillero. Las
  fórmulas impresas del formulario quedan en `formulario-104.md` como referencia para
  quien implementa el dominio; el sistema no las lee ni las ejecuta.
- **Importación del formulario.** El administrador sube el PDF una vez; se guarda el
  catálogo completo de campos (código, nombre, sección) y nada más: ni el PDF, ni
  valores, ni datos personales. El sistema relaciona cada resultado con su campo en
  cascada (relación guardada → coincidencia por atributos → IA opcional → sin casillero)
  y guarda la relación por versión del formulario, junto con la razón por la que se ubicó ahí. El administrador es del sistema y no corrige relaciones.
- **Alcance del formulario reducido a lo básico de ventas y compras.** Fuera: liquidación,
  saldos de crédito anteriores (605) y total a pagar.
- **Ventas con `IVA = 0`: las marca el usuario** en una tabla tras la carga. El factor no
  se calcula mientras haya ventas sin marcar. La bitácora cubre también este marcado.
- **Compras con `IVA = 0` sin decisión por comprobante**: un total informativo con un
  casillero aproximado sugerido.
- **Se elimina `attribution`.** La clasificación de una compra es 500 o 502.
- **El MVP se limita al formulario mensual.** El semestral pasa a `NEXT_STEPS.md`.

### Corregido
- **Factor de proporcionalidad.** Se había documentado que con ventas sin IVA el
  factor es cero. Es incorrecto: exportaciones y ventas 0% con derecho a crédito
  suman al numerador (`1.0000` para quien solo exporta servicios). Corregido en
  `mvp-scope.md`, `code-flow.md`, `formato-archivos-sri.md` y `CLAUDE.md`.
- ADR-008 y ADR-010 anotados: `IVA = 0` sin decisión aplica a compras, no a ventas;
  los comprobantes de retención podrían alimentar el 609.
- **`docker-compose.yml` eliminado.** El desarrollo local usa un contenedor
  `postgres18` administrado a mano (`docker start` / `docker run` +
  `scripts/setup-db.sh`), no `docker compose up`. ADR-002 todavía nombra
  `docker-compose.yml` como el mecanismo elegido — sigue pendiente un ADR nuevo
  que lo reemplace formalmente; por ahora `docs/LOCAL-DEVELOPMENT.md` es la
  fuente de verdad para el flujo real.
- **`GETTING_STARTED.md` desactualizado.** Decía PostgreSQL 16+ (es 18+), y
  listaba `npm run migrate` y `npm run test:rls`, que no existen (el script real
  es `db:migrate`; no hay todavía un test de aislamiento RLS permanente).
  Corregido para reflejar los pasos que de verdad funcionan hoy.
