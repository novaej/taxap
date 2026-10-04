# Next steps

What's already resolved lives in [`CHANGELOG.md`](CHANGELOG.md), not here.

## Open decisions

**Where to deploy.** DigitalOcean is the leading option based on prior
experience (droplet + Docker + Caddy + Terraform + Cloudflare, the pattern
from `comprobify-web/docs/adr/008`). Not decided until there's something
to deploy. A warning on record from that project: **the cheapest droplet
fell short for Next.js with Prisma.** Start at least one tier up.

**Storage of original files.** Keeping the uploaded `.txt` files allows
reprocessing without asking for them again. Filesystem locally; in
production, S3-compatible storage. Not yet decided whether they're kept
indefinitely.

**Terms and conditions.** [ADR-014](docs/adr/014-caracter-asistivo-y-disclaimers.md)
sets the product stance. The legal text needs professional review before
opening to real users.

## To build

- [ ] **Improve automatic extraction of the form's PDF**
      (`src/services/forms/pdf-field-extractor.ts`, since 2026-10-04).
      It's plain-text heuristics — no real position/layout data from the
      PDF — and is known to fail on wrapped lines and on formulas printed
      inside the cell itself (e.g. "482-484"). It works well for the
      common case (name + code + gross/net/tax on a single line) and the
      admin reviews/corrects the rest before publishing (ADR-015), but an
      extraction based on each text block's real position (via
      `pdfjs-dist` directly, not just its plain text) would be more
      accurate.
- [ ] **Calculation of `result_mappings`** (ADR-015, the 4-tier cascade:
      prior version → attribute match → AI → no field). Today an admin
      can publish a `form_version` with its `form_fields`, but nothing
      builds the result→field relationship yet — the pre-filing still
      only shows the domain's keys.
- [ ] **RLS regression test.** It has been manually verified against the
      real database several times, but it hasn't been left as a
      reproducible artifact (`tests/rls/`, per
      `docs/guides/coding-guidelines.md`). Write one before touching
      `src/lib/db.ts` again.
- [ ] **Measure the classification step** with a real period and many new
      suppliers. If it doesn't fit in one HTTP request, pg-boss comes in
      ([ADR-011](docs/adr/011-ingesta-y-clasificacion-en-dos-pasos.md)).

## Pending normative verification

None of this gets resolved with code — it requires real SRI files,
checking the portal, or confirming an effective date:

- [ ] **Complete `docs/tax/formato-archivos-sri.md`** with files that
      include credit notes, debit notes, and withholding vouchers.
- [ ] **Verify and load `tax_rates`.** The screen (`/admin/tasas`) has
      existed since 2026-10-04 and won't let anything be saved without a
      source and verification date — the verification itself is still
      missing (`docs/tax/tasas-iva.md`: no rate confirmed yet).
- [ ] **Verify with the portal** whether 563/564/565 and the totals
      (409/419/429, 509/519/529) are computed by the portal from what's
      entered ([`docs/tax/formulario-104.md`](docs/tax/formulario-104.md)
      → *Pending verification*). Includes what the portal expects when the
      factor's denominator is zero (the domain already blocks that case
      with an explicit reason; what's missing is whether the portal needs
      something typed in regardless).
- [ ] **Test the mapping against the real form** before building on top of
      it: that every MVP result lands on the expected field from
      [`formulario-104.md`](docs/tax/formulario-104.md). This is the main
      risk of [ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md):
      a correct value next to the wrong field.
- [ ] **Sanitize the sample PDF** for use as a parser test fixture
      ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md)). The
      original carries personal data and isn't version-controlled.
- [ ] **Verify with a real file** whether received withholding vouchers
      feed into field 609.

## Out of MVP scope

### Taxes
- **Income Tax.** The personal-expense model has changed: it's now a
  **reduction** calculated on the basic family basket and dependents, with
  more categories than the original two in the initial definition.
  Requires full normative verification.
- **Withholdings.**
- **ATS.** Probably the biggest commercial hook after VAT: it's painful
  monthly work and the data model already contains almost everything
  needed.

### Product
- **Settlement and balances.** Fields 480–499 and 601–999: the month's
  settlement, credit balances carried from prior months (605 ← 615 from
  the previous period), total due. These require either a carry-forward
  mechanism between periods or manual entry.
- **`IVA = 0` purchases with a definitive field** (507, 508, 531, 532).
  Today there's only an informational total with an approximate suggested
  field.
- **Fixed assets** (402, 501…): the SRI file doesn't distinguish them.
- **Semiannual VAT.** It's a different form (probably Form 104A
  `[VERIFICAR]`), with its own fields. A sample is needed to import its
  definition ([ADR-015](docs/adr/015-definicion-del-formulario-desde-pdf.md));
  the structure already supports it. In the meantime a semiannual taxpayer
  can register, but the MVP doesn't generate their pre-filing.
- Firms with multiple users. The structure already supports this
  ([ADR-003](docs/adr/003-usuario-como-tenant-con-tabla-de-union.md));
  missing an invitation interface and permission management.
- Subscription billing and payment collection.
- Period-over-period comparison, to detect anomalous variations.
- Excel or PDF export of the draft.
- English. `next-intl` has been there from the start; `messages/en.json`
  is missing.

### Technical
- Ingestion of voucher XML, which does carry line-item detail. It will
  coexist with the TXT at a different precision
  ([ADR-008](docs/adr/008-solo-totales-sin-detalle-de-lineas.md)).
- Archiving policy for `classification_events`.
- Alert when a period uses an expired normative effective date.
- Advisory per-period lock to prevent concurrent classification.
