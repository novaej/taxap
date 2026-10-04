# ADR-014: The system's assistive character

## Status
Accepted

## Date
2026-09-20

## Context

taxap calculates values that feed into a tax return. An incorrect filing
has real consequences — fines, interest, assessments — for the taxpayer,
and the party responsible to the tax authority is always the taxpayer or
their accountant, never the software.

Moreover, the system has known, structural limitations that can't be
resolved, because they come from the data source:

- It works with totals, not line-item detail
  ([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)).
- It doesn't distinguish 0% rate, exempt, and not subject to VAT.
- It classifies from the supplier and economic activity, with no concept.
- Some of its classifications come from inference, not certainty.

A product that presents its results as final would be misrepresenting
what it does, and creating an expectation it can't sustain.

## Decision

**The assistive character is expressed in the product's design, not only
in a legal text.** Three levels:

**1. In the language.** The UI is in Spanish, and there is no "Declarar"
("File") button, no "Listo para declarar" ("Ready to file") status. The
literal words the product's vocabulary must never use, and what it uses
instead:

| Used (Spanish, literal) | English gloss | Not used (Spanish, literal) | English gloss |
|---|---|---|---|
| Borrador generado | Draft generated | Listo para declarar | Ready to file |
| Pendiente de revisión | Pending review | Procesado, sin más | Processed, full stop |
| Valor sugerido | Suggested value | Valor calculado | Calculated value |
| Marcar como declarado | Mark as filed | Declarar | File |

**2. In the interface.** A permanent — non-dismissible — notice on the
pre-filing screen and on every exported or printed draft, in Spanish
since that's the UI's language (English gloss alongside each, for this
document only):

> Cálculo asistido, pendiente de revisión del responsable antes de
> presentarse al SRI. No sustituye el criterio profesional.
>
> (Assisted calculation, pending review by the responsible party before
> filing with the SRI. Does not substitute for professional judgment.)

And a specific notice about the scope of the data:

> Los cálculos se basan en los totales de cada comprobante. Los archivos
> del SRI no incluyen el detalle de líneas, así que si necesitas
> desglosar un comprobante, revisa el original.
>
> (Calculations are based on each voucher's totals. SRI files don't
> include line-item detail, so if you need to break down a voucher,
> review the original.)

**3. In acceptance.** On registration, the user explicitly accepts the
terms. Acceptance is versioned and recorded with who and when, following
`comprobify`'s pattern.

**Design corollary:** the system never hides its uncertainty to look
better. A voucher that couldn't be classified with confidence goes to the
queue even if that makes the product look less automatic. Per-field
traceability exists precisely so the user can be skeptical and verify.

## Consequences

### Positive
- What the product promises matches what it does.
- Responsibility stays where it legally and professionally belongs.
- It pushes toward sound design decisions: traceability, a visible queue,
  inspectable assumptions ([ADR-012](012-tasas-y-casilleros-como-datos-con-vigencia.md)).

### Negative
- Commercially it's less appealing than "file in one click." That's the
  cost of being accurate about what the system does.
- Permanent notices take up space and, with repeated use, stop being
  read. Mitigated by making them specific and contextual instead of a
  generic block.
- A user can still blindly trust it. The notice reduces the risk, it
  doesn't eliminate it. That's why the real mitigation is traceability:
  making review easy.

## Note

This ADR describes a product and design stance. **It does not constitute
legal advice and does not substitute for a review of the terms and
conditions by a professional**, which must happen before opening the
product to real users.
