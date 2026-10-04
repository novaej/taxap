# Documentation checklist

What to update depending on the kind of change.

---

## New tax rule or calculation

- [ ] `src/domain/` — the rule, pure and with no I/O
- [ ] `tests/domain/` — edge cases: zero factor, credit notes from
      another period, `IVA = 0`, mixed invoices
- [ ] `docs/tax/` — if it introduces a normative value, with **source and
      date**
- [ ] `docs/adr/` — if it changes an already-decided criterion
- [ ] `CHANGELOG.md`

## New screen

- [ ] `src/app/[locale]/(app)/.../page.tsx`
- [ ] `messages/es.json` — no literals in components
- [ ] `docs/guides/code-flow.md` — add the screen to the walk-through
- [ ] Check the vocabulary against [ADR-014](../adr/014-caracter-asistivo-y-disclaimers.md)
- [ ] `CHANGELOG.md`

## New table or column

- [ ] `prisma/schema.prisma` + migration
- [ ] **Does it hold taxpayer data? → RLS policy**
      ([ADR-004](../adr/004-rls-por-usuario-con-prisma.md))
- [ ] `docs/data-model.md`
- [ ] Money? → `DECIMAL(14,2)`
- [ ] `CHANGELOG.md`

## Change to the SRI parser

- [ ] `docs/tax/formato-archivos-sri.md` — with evidence from a real file
- [ ] Cross off the corresponding pending item if verified
- [ ] `tests/domain/` — a case with the real row
- [ ] `CHANGELOG.md`

## Architecture decision

- [ ] `docs/adr/NNN-name.md` — new, **never edit an existing one**
- [ ] `docs/adr/README.md` — add to the table
- [ ] If it replaces another, mark the previous one as *Replaced by ADR-NNN*
- [ ] `CLAUDE.md` — if it introduces a hard rule
- [ ] `CHANGELOG.md`

## New environment variable

- [ ] `.example.env` — with a comment explaining what it's for
- [ ] `GETTING_STARTED.md` — if the user needs to configure it
- [ ] `CHANGELOG.md`

## Bug fix

- [ ] `CHANGELOG.md` under "Fixed"
- [ ] `CLAUDE.md` under "Easy mistakes to make here," if it's a recurring
      kind of mistake

---

## Document index

| File | Updated when |
|---|---|
| `docs/adr/` | An architecture decision is made |
| `docs/data-model.md` | The schema changes |
| `docs/tax/` | A normative value changes or is verified |
| `docs/guides/code-flow.md` | A period's walk-through changes, or a screen is added/modified |
| `CLAUDE.md` | A new hard rule or recurring mistake |
| `CHANGELOG.md` | Every change |
| `NEXT_STEPS.md` | A pending item is completed or discovered |
| `.example.env` | A new environment variable |
| `GETTING_STARTED.md` | Installation steps or the quick-start walk-through change |
| `TROUBLESHOOTING.md` | A new recurring environment/infrastructure error (not tax-related — that goes in `CLAUDE.md`) |
