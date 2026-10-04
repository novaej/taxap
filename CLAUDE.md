# Rules for AI assistants

Required context before writing code here:
[`docs/guides/code-flow.md`](docs/guides/code-flow.md) (how the app works today),
[`docs/data-model.md`](docs/data-model.md) and [`docs/adr/`](docs/adr/).

---

## Hard rules

**1. `src/domain/` does not import infrastructure.**
No `@prisma/client`, `next`, `fetch`, or database access. It receives plain
objects and returns verdicts. If a domain function needs the VAT rate, it is
**passed** in as a parameter; it never queries for it. ([ADR-001](docs/adr/001-nextjs-monolito-con-capa-de-dominio.md))

**2. A protected table is never queried outside the user wrapper.**
A direct `prisma.invoicesReceived.findMany()` **returns everything, unfiltered**.
It compiles and runs, and it is the most severe failure possible in this product.
Every access goes through the wrapper that sets `app.current_user_id`.
([ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md))

**3. Money is `Decimal`, never `number`.**
`DECIMAL(14,2)` in PostgreSQL, `Prisma.Decimal` in TypeScript. No monetary
operation in floating point.

**4. Rates and fields are never hardcoded.**
They are looked up by the date of the event. ([ADR-012](docs/adr/012-tasas-y-casilleros-como-datos-con-vigencia.md))

**5. No value is derived that the source doesn't already provide.**
`subtotal` and `vat_amount` are faithful copies from the file. Neither the
taxed base nor the 0% base is calculated. ([ADR-008](docs/adr/008-solo-totales-sin-detalle-de-lineas.md))

**6. No classification change without an event in the audit log.**
([ADR-013](docs/adr/013-bitacora-inmutable-y-bloqueo-de-periodo.md))

**7. Form 104 is the destination for results, not a source of calculation.**
The system calculates with its own logic and the user copies the values into
the SRI portal. Neither the values nor the formulas from the form's PDF feed
anything; the formulas in [`formulario-104.md`](docs/tax/formulario-104.md) are
reference material for whoever implements the domain.

**The domain does not know field numbers.** It produces results with a stable
key and a structured description (`SALES_TAXED`, `PURCHASES_WITH_CREDIT`…); the
system relates them to the form's catalog by meaning and stores the
relationship in `result_mappings`. Never write `401` or `500` in `src/domain/`.
([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md))

**8. The MVP only covers the monthly form.** The semiannual one is a different form.

**9. The product's vocabulary never promises what the system doesn't do.**
The UI is in Spanish, and the literal words to never use there are
"Declarar" or "Listo para declarar" ("File" / "Ready to file") — the
system calculates, but filing with the SRI is always the user's own,
separate action. ([ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md))

---

## Easy mistakes to make here

| Mistake | Why it matters |
|---|---|
| Using `FECHA_AUTORIZACION` to assign the period | The period is determined by `FECHA_EMISION` |
| Assuming a comma delimiter | They are TXT files separated by **tabs** |
| Assuming two decimals in the source text | The SRI writes `4.5`, not `4.50` |
| Excluding credit notes from the VAT calculation | **They subtract.** Ignoring them overstates the credit ([ADR-010](docs/adr/010-tratamiento-por-tipo-de-comprobante.md)) |
| Classifying vouchers with `IVA = 0` | They don't enter the cascade |
| Keying a rule by supplier alone | It's `(taxpayer, supplier, activity fingerprint)` ([ADR-006](docs/adr/006-reglas-por-proveedor-y-actividad-economica.md)) |
| Querying the AI per voucher | It's **per supplier** ([ADR-005](docs/adr/005-clasificacion-en-cascada.md)) |
| Sending the taxpayer's RUC or name to the AI | It never leaves the system ([ADR-007](docs/adr/007-modo-sin-ia-y-catalogo-compartido.md)) |
| Assuming sales without IVA give a factor of zero | **No.** Exports and 0%-rated sales with credit entitlement add to the numerator: factor `1.0000` ([`formulario-104.md`](docs/tax/formulario-104.md)) |
| Treating the factor as a single number without context | It depends on the destination of each sale with `IVA = 0`, which the file doesn't indicate |
| Reading, storing, or executing a formula printed in the form's PDF | The form is a destination, not a source. The logic lives in `src/domain/`, written and tested ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)) |
| Calculating the factor with unmarked `IVA = 0` sales | Blocked until the user marks the destination of each one |
| Saving the form's PDF, its values, or its formulas | Only the field catalog is saved (code, name, section). The PDF carries personal data |
| Having the admin assign or correct results | The admin is **of the system**, not of a taxpayer: they only import the form. Every relationship is explained; no one edits it by hand |
| Showing a result with a field but no explanation | It's an approximation: always with the official name and the reason |
| Blocking the calculation because a result has no field | It's shown without a code and flagged; it doesn't block |
| Adding `attribution` (direct / proratable) | It was removed: a purchase's classification is 500 or 502 |
| Splitting `IVA = 0` purchases across 507, 508, 531, 532 | They don't go to a field; just an informational total |
| Treating a field missing from an import as deleted | It's "not observed"; it's only removed by an explicit action |
| Rewriting an ADR after changing one's mind | A new one is written that replaces it |
| Enabling RLS with only `ENABLE ROW LEVEL SECURITY` | It's not enough if the app connects with the same role that owns the tables (the case here: `taxap` runs the migrations and serves the queries). Postgres exempts the owner from its own policies unless `FORCE ROW LEVEL SECURITY` is also set. Without it, the policies exist but silently filter nothing ([ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md)) |

---

## AI models

| Use | Model |
|---|---|
| Bulk classification | `claude-haiku-4-5` |
| Escalation of ambiguous cases | `claude-opus-5` |

With structured outputs (`output_config.format`), never by parsing prose. Batch
API for the bulk pass. Every response logs `model_id` and `prompt_version`.

---

## Verification before touching the SRI format

Before writing or modifying a parser, read
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).
That document was verified against real files and contains a list of
pending items. **Don't invent columns or assume literals** that aren't there.

## Normative values

Every tax figure in `docs/tax/` carries a source and a verification date. If
one is missing, it's marked `[VERIFICAR]` and **is not loaded into the
system**. Never fill in a `[VERIFICAR]` from memory.

---

## When finishing a change

See [`docs/guides/documentation-checklist.md`](docs/guides/documentation-checklist.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
