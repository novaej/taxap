# Especificaciones de pantalla

Cada archivo es el contrato de una pantalla **antes** de construirla: ruta prevista,
acceso, qué hace, con qué capas habla, y criterios de aceptación. Sigue el formato de
`comprobify-web/docs/site/screens/`, adaptado: como aquí todavía no hay código, estas
son especificaciones para guiar la construcción, no documentación de algo existente.
Cuando se construya la pantalla, este archivo se actualiza para reflejar lo real —
nunca al revés.

## Convenciones

- **Ruta** y **Server Actions**: nombres propuestos, en `src/app/[locale]/(app)/[taxpayerId]/...`
  salvo que se diga lo contrario. `[taxpayerId]` está ausente en pantallas de admin.
- **Acceso**: rol (`INDIVIDUAL` \| `ACCOUNTANT` \| `ADMIN`) y, cuando aplica, el
  contribuyente debe estar en `user_taxpayers` del usuario autenticado
  ([ADR-004](../../adr/004-rls-por-usuario-con-prisma.md)).
- **Layout**: boceto en ASCII, no diseño visual final.
- Toda pantalla que muestre resultados de cálculo lleva el aviso de
  [ADR-014](../../adr/014-caracter-asistivo-y-disclaimers.md) — no se repite en cada
  spec, se asume.

## Índice

| Pantalla | Ruta | Quién |
|---|---|---|
| [ingesta.md](ingesta.md) | `/[taxpayerId]/periodos/[periodId]/ingesta` | `INDIVIDUAL`, `ACCOUNTANT` |
| [ventas-emitidas.md](ventas-emitidas.md) | `/[taxpayerId]/periodos/[periodId]/ventas` | `INDIVIDUAL`, `ACCOUNTANT` |
| [conciliacion.md](conciliacion.md) | `/[taxpayerId]/periodos/[periodId]/conciliacion` | `INDIVIDUAL`, `ACCOUNTANT` |
| [pre-declaracion.md](pre-declaracion.md) | `/[taxpayerId]/periodos/[periodId]` | `INDIVIDUAL`, `ACCOUNTANT` |
| [admin-formulario.md](admin-formulario.md) | `/admin/formularios` | `ADMIN` |

## Pendiente

Fuera de esta ronda, porque dependen menos de las decisiones recientes: registro y
alta de contribuyentes, selector de contribuyente, listado de períodos, cierre y
reapertura de período. Se documentan cuando se construyan o antes si el usuario lo
pide.
