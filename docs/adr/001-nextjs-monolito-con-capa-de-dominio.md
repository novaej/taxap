# ADR-001: Monolito Next.js con capa de dominio pura

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Había tres formas de estructurar esto:

1. **API separada + frontend**, como `comprobify` y `comprobify-web`.
2. **Monolito Next.js plano**, con toda la lógica en `src/lib/`, como `comprobify-web`.
3. **Monolito con capa de dominio**, tomando de `salon-cloud` la separación en capas.

`comprobify-web` funciona bien con `src/lib/` plano porque es esencialmente un BFF:
la lógica de negocio vive en la API de `comprobify` y el frontend solo la consume.

taxap es lo contrario. El motor tributario **es** el producto. La lógica de
clasificación, el factor de proporcionalidad y el armado de casilleros son reglas
con muchos casos límite, donde un error no produce un error visible sino una
declaración incorrecta.

No hay consumidores externos de API previstos, así que separar en dos repos
agregaría un contrato, un despliegue y una superficie de autenticación sin
beneficio actual.

## Decisión

**Un solo repositorio, aplicación Next.js, con una capa de dominio pura aislada.**

```
src/
├── domain/      ← sin I/O. No importa Prisma, ni next, ni fetch.
├── services/    ← orquestación: domain + base de datos + IA
├── lib/         ← infraestructura (db, auth, rbac, ia, almacenamiento)
├── app/         ← rutas, Server Actions, UI
└── components/
```

La regla dura: **`src/domain/` no importa nada de `@prisma/client` ni de `next`.**
Recibe objetos planos y devuelve veredictos. Se prueba con Vitest sin base de datos
ni servidor.

Los tests de `tests/domain/` son el activo más valioso del repositorio.

## Consecuencias

### Positivas
- El motor tributario se prueba exhaustivamente en milisegundos, sin infraestructura.
- Cambiar de ORM, de framework o de UI no toca las reglas tributarias.
- Si en el futuro hace falta exponer el motor como API, `domain` y `services` se
  extraen sin reescribirlos.

### Negativas
- Una capa más de indirección que un `src/lib/` plano. Para el CRUD simple
  (alta de contribuyentes, edición de perfil) es sobrecarga sin retorno — ese
  código va directo en `services/` o en la Server Action, sin pasar por `domain/`.
- La disciplina no se impone sola. Requiere una regla de lint que prohíba importar
  `@prisma/client` desde `src/domain/`, o se erosiona en el tercer mes.

## Alternativas consideradas

**API separada en dos repos.** Se justificaría si se planeara vender acceso por API
a otros sistemas contables. No es el caso hoy, y la capa de dominio deja esa puerta
abierta sin pagar el costo ahora.

**Monolito plano estilo `comprobify-web`.** Más rápido de arrancar. Descartado
porque mezcla las reglas tributarias con acceso a datos, y entonces probar
"¿qué pasa si el factor de proporcionalidad da cero?" requiere una base de datos
con datos montados. Eso hace que los tests no se escriban.

**Clean Architecture completa estilo `salon-cloud`** (Domain / Application /
Infrastructure / Web como proyectos separados). Apropiado en .NET con varios
equipos; excesivo para un repositorio de TypeScript con un desarrollador.
Se toma la idea del núcleo puro, no la ceremonia.
