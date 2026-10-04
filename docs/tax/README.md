# Tax reference

This directory records **where the normative values the system uses come
from, and when they were verified**, so that a year from now it's
possible to tell whether they're still in effect.

This is not the regulation itself. It's the human-readable companion to
the `tax_rates` table and the form-definition tables (`form_fields`),
which are what the code actually queries
([ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md)).

| Document | Content |
|---|---|
| [`formato-archivos-sri.md`](formato-archivos-sri.md) | Structure of the portal's `.txt` files. **Verified against real files.** |
| [`tasas-iva.md`](tasas-iva.md) | History of rates with effective dates |
| [`formulario-104.md`](formulario-104.md) | Field catalog. **Verified against a real form.** Includes open decisions. |

## Rule for this directory

Every numeric value carries **source and verification date**. A value
without that is marked `[VERIFICAR]` and isn't loaded into the system's
tables until confirmed.

This is deliberate: it's better for data to be visibly missing than for
incorrect data to look verified.

## What isn't here

**Filing periodicity** is not a normative value derived by this system.
The SRI assigns it to each taxpayer and it's recorded on their RUC; the
user enters it when registering the taxpayer and it's editable. See
[ADR-012](../adr/012-tasas-y-casilleros-como-datos-con-vigencia.md).
