# Checklist de documentación

Qué actualizar según el tipo de cambio.

---

## Regla o cálculo tributario nuevo

- [ ] `src/domain/` — la regla, pura y sin I/O
- [ ] `tests/domain/` — casos límite: factor cero, notas de crédito de otro
      período, `IVA = 0`, facturas mixtas
- [ ] `docs/tax/` — si introduce un valor normativo, con **fuente y fecha**
- [ ] `docs/adr/` — si cambia un criterio ya decidido
- [ ] `CHANGELOG.md`

## Pantalla nueva

- [ ] `src/app/[locale]/(app)/.../page.tsx`
- [ ] `messages/es.json` — sin literales en los componentes
- [ ] `docs/guides/code-flow.md` — agregar la pantalla al recorrido
- [ ] Verificar el vocabulario contra [ADR-014](../adr/014-caracter-asistivo-y-disclaimers.md)
- [ ] `CHANGELOG.md`

## Tabla o columna nueva

- [ ] `prisma/schema.prisma` + migración
- [ ] **¿Contiene datos de contribuyentes? → política de RLS**
      ([ADR-004](../adr/004-rls-por-usuario-con-prisma.md))
- [ ] `docs/data-model.md`
- [ ] ¿Dinero? → `DECIMAL(14,2)`
- [ ] `CHANGELOG.md`

## Cambio en el parser del SRI

- [ ] `docs/tax/formato-archivos-sri.md` — con evidencia del archivo real
- [ ] Tachar el pendiente correspondiente si se verificó
- [ ] `tests/domain/` — caso con la fila real
- [ ] `CHANGELOG.md`

## Decisión de arquitectura

- [ ] `docs/adr/NNN-nombre.md` — nuevo, **nunca editar uno existente**
- [ ] `docs/adr/README.md` — agregar a la tabla
- [ ] Si reemplaza a otro, marcar el anterior como *Reemplazado por ADR-NNN*
- [ ] `CLAUDE.md` — si introduce una regla dura
- [ ] `CHANGELOG.md`

## Variable de entorno nueva

- [ ] `.example.env` — con comentario explicando para qué sirve
- [ ] `GETTING_STARTED.md` — si el usuario debe configurarla
- [ ] `CHANGELOG.md`

## Corrección de error

- [ ] `CHANGELOG.md` en "Corregido"
- [ ] `CLAUDE.md` en "Errores fáciles de cometer aquí", si es de los que se repiten

---

## Índice de documentos

| Archivo | Se actualiza cuando |
|---|---|
| `docs/adr/` | Se toma una decisión de arquitectura |
| `docs/data-model.md` | Cambia el esquema |
| `docs/tax/` | Cambia o se verifica un valor normativo |
| `docs/guides/code-flow.md` | Cambia el recorrido de un período, o se agrega/modifica una pantalla |
| `CLAUDE.md` | Nueva regla dura o error recurrente |
| `CHANGELOG.md` | Cada cambio |
| `NEXT_STEPS.md` | Se completa o se descubre un pendiente |
| `.example.env` | Nueva variable de entorno |
| `GETTING_STARTED.md` | Cambian los pasos de instalación |
