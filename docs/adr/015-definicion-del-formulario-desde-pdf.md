# ADR-015: The system knows the form and relates each result to its field

## Status
Accepted

## Date
2026-09-20

## Context

taxap calculates values that the user then **enters** into the period's
Form 104, on the SRI portal. The form is the destination of those
results, not a source for calculation.

When calculating a taxpayer's filing, every result has to be able to say
where it goes. If the calculation shows that 1,000 is purchases with
credit entitlement, or that 200 is an amount with no VAT, the system has
to know **approximately** which form field it corresponds to, and display
it like this:

```
Acquisitions with tax credit entitlement (gross value) — 500 = 1,000.00
```

For that, the system needs to know the whole form: which fields exist,
under what official name, and in which field number. The form has more
than two hundred fields and the SRI can change it. There are three bad
ways to solve this:

- **Transcribe it by hand**: a mistyped field number sends a total to the
  wrong field with nothing failing, and there's no update path.
- **Write the field number into the code** (`SALES_TAXED → 401`): every
  SRI change demands a deployment, and which field governed a past period
  is lost.
- **Keep the PDF**: it contains a real person's tax return.

An already-filed form, downloaded from the portal, contains the whole
structure. Examining a real one confirmed it has a **text layer** (it
reads without OCR), that rows follow regular patterns (gross / net / tax
triplets), and that some descriptions break across several lines or
continue onto the next page (field 603).

## Decision

### 0. The form is not an input to the calculation

All calculation lives in `src/domain/` and is based on the vouchers and
on what the user marks. Neither the PDF's values nor the formulas it
prints feed into the system. The formulas are transcribed in
[`formulario-104.md`](../tax/formulario-104.md) only as a reference for
whoever implements the domain. The form is also not used to compare
against or validate results: its only function is to be the place where
values get copied.

### 1. The administrator uploads the form once; the system stores its full catalog

A PDF of an already-filed form is uploaded, and re-uploaded whenever the
SRI updates it. The system reads it and stores **every field**: field
code, official name, section, column type, and order.

**Only the structure is stored, nothing else.** Values, formulas, and
personal data (identification, legal name, serial number, check code,
filing dates) are neither extracted nor persisted, and **the original PDF
is not stored**. Its `sha256` is kept so a given file can be confirmed to
have produced a given version.

**Deterministic extraction.** The text layer is read and parsed with
code. A PDF with no text layer (scanned) is rejected.

### 2. The system relates each result to a field, by meaning

The domain produces **results with a stable key** (`SALES_TAXED`,
`PURCHASES_WITH_CREDIT`, `PROPORTIONALITY_FACTOR`…) and **knows nothing
about field numbers**. Every result carries a **structured description**
of what it is:

| Attribute | Example |
|---|---|
| Operation | sale / purchase |
| Treatment | taxed, 0% with credit entitlement, export of services, no credit entitlement… |
| Column | gross / net / tax |
| Fixed asset | no |

The system compares that description against the catalog's official
names and **suggests the closest field**. No one assigns each result by
hand. The relationship is approximate by nature, so it's resolved in a
cascade, just like purchase classification
([ADR-005](005-clasificacion-en-cascada.md)):

| Level | Mechanism | Deterministic |
|---|---|---|
| 1 | Relationship already stored for that form version | Yes |
| 2 | Attribute match against field names and position | Yes |
| 3 | AI — **optional**; receives only field names and result descriptions | No |
| 4 | No match: the result is shown with no field, and flagged | — |

**The relationship is computed once per form version and stored**, so the
same result always lands in the same field for every user, and a past
period is explained the same way again. What level 3 sends the AI is pure
structure: nothing about taxpayers, vouchers, or values.

### 3. The relationship is approximate, and it's explained

The relationship is an **approximation**
([ADR-014](014-caracter-asistivo-y-disclaimers.md)) and is presented as
one. Every result is shown with the field's **official name** next to the
value, and with **the reason it was placed there**:

```
Acquisitions with tax credit entitlement (gross value) — 500 = 1,000.00
  Why here? These are purchases with VAT and credit entitlement, and
  field 500 is named "Acquisitions and payments … taxed at a rate other
  than zero (with tax credit entitlement)," gross-value column.
```

The explanation is stored alongside the relationship (`reason`). At level
2 it comes from a template combining the result's description and the
field's name; at level 3, from the brief reasoning the AI returns.

**No one corrects relationships by hand.** The administrator is the
**system's administrator**, not a taxpayer's: they upload the form and
don't intervene in results or see taxpayer data. Whoever reads the return
has the official name and the reason to judge whether the placement is
reasonable. A wrong relationship is fixed by improving the matching rules
in code, with a test covering it, or with a new form version.

### 4. Import flow

```
Upload PDF → extract → validate → compare against the current catalog → publish
```

**Structural validation.** Unique codes; every field has a name; the
triplets follow the expected numeric pattern. A violation stops the
import with the detail.

**Comparison.** Against the current version: new fields, renamed fields,
and fields no longer present. Stored relationships whose field didn't
change are kept; those pointing to a modified field are recalculated for
the new version. The administrator reviews before publishing.

**The administrator sets the effective date.** A sample PDF states the
period of that return, not since when that form version has been in
effect. `valid_from` is entered explicitly.

**Absence isn't removal.** A form can omit sections depending on the
taxpayer type. A field missing from a new PDF is marked **not observed**
and flagged; it's only removed by explicit action.

### 5. Immutable, traceable versions

A version used by any period is never modified. Every `tax_periods` row
stores the `form_version_id` the result was filed with, so a past period
can always be re-explained with the form that governed it then.

### 6. One form per code; the MVP covers only the monthly one

The version is identified by `form_code`. **The MVP supports only the
monthly Form 104.** The semiannual one is a different form and is out of
scope; the same import mechanism will serve it once it's added.

## Consequences

### Positive
- The system knows where each result goes without anyone assigning them
  one by one, and keeps knowing when the SRI changes the form: the new
  PDF is uploaded and the diff is reviewed.
- The code doesn't depend on the SRI's numbering.
- A past period knows which form it was filed with, and the stored
  relationship makes it reproducible.
- No PDF or personal data is retained; what's stored (codes and names)
  identifies no one.
- Since the form doesn't take part in the calculation, a reading or
  matching error can show a value under the wrong field, but **it can't
  produce an incorrect value.**

### Negative
- **An approximate relationship can be wrong.** This is the failure that
  matters most: a correct value appearing next to the wrong field, with
  nothing failing. It's more likely than with manual assignment.
  Mitigations: the cascade starts with the deterministic levels, the
  relationship is stored and stable, and the official name and the
  reason always travel with the value. **The MVP's set of results with
  their expected field
  ([`formulario-104.md`](../tax/formulario-104.md)) must be used as
  matching tests**, to detect when a form or rule change breaks a known
  relationship.
- **Without manual correction, a wrong relationship persists** until the
  matching rules change or a new form version arrives. That's the
  tradeoff for no one assigning anything by hand, and what makes the test
  suite important.
- The SRI's names can be reworded without the field number changing, and
  then name-based matching loses the relationship even though the field
  is still the same one. The diff catches it, but it has to be reviewed
  on every update.
- **The parser is the fragile part.** Split descriptions and
  continuation across pages complicate the order of the extracted text.
  It needs tests with real cases.
- **Tests need a sample PDF, and the real one can't be version-controlled.**
  A sanitized or synthetic one has to be generated.
- A single sample only offers one view of the form. If there are
  conditional sections, a field could be missing; resolved with another
  import.

## Alternatives considered

**Have the administrator assign or correct each result.** Gives maximum
certainty about each relationship. Discarded: the goal is for the system
to know the form and know where each result goes without that manual
step, and the administrator is the system's, not the taxpayers': it's not
their place to intervene in anyone's results.

**Store only the fields that are used.** Saves space. Discarded: the
system needs the full catalog to relate new results without re-uploading
the PDF.

**Field numbers in code.** Simple and type-checked. Discarded: every SRI
change becomes a deployment, and per-period traceability is lost.

**Hand-seeded table.** No parser. Discarded: prone to errors in the
product's most critical data, with no update path.

**Extract the PDF with vision AI.** Would tolerate any layout. Discarded:
it would send a document with personal data to a third party, and a
misread field number is a silent error. AI only steps in, optionally, to
match on structure with no data.

**Keep the original PDF.** Discarded: it's a privacy liability, and the
`sha256` covers the traceability need.

**An official structured source** published by the SRI. Would be ideal,
but none was identified — `[VERIFICAR]`. If one exists, this ADR gets
replaced.
