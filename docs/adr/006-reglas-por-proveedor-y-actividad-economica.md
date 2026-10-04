# ADR-006: Rules by supplier and economic activity

## Status
Accepted

## Date
2026-09-20

## Context

Level 1 of the cascade ([ADR-005](005-clasificacion-en-cascada.md))
remembers how a supplier was classified before. What's left to define is
the key for that memory.

SRI files carry, as usable signal: the issuer's RUC and legal name, the
voucher type, and the amounts. **They carry no concept or description**
([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)).

But the supplier alone isn't enough. The same supplier means different
things depending on who's buying:

| Supplier | Taxi company | Law firm | Restaurant |
|---|---|---|---|
| Fuel distributor | Core operating expense | Likely mixed | Marginal |
| Supermarket chain | Hardly deductible | Hardly deductible | Deductible input |

What changes between columns is the **taxpayer's economic activity**. And
that activity isn't fixed: a taxpayer can add a new activity to their RUC,
and then purchases that were clearly non-deductible before become an
operating expense of the new business line.

## Decision

**The key for a rule is `(taxpayer, supplier, economic activity
fingerprint)`.**

```
supplier_rules
├── taxpayer_id
├── supplier_ruc
├── activity_fingerprint   ← hash of the set of activities when the rule was created
├── iva_category
├── source, created_by, created_at, revoked_at
```

When the taxpayer's economic activities change, `activity_fingerprint` is
recalculated. Rules issued under the previous fingerprint are **neither
deleted nor silently applied**: they're flagged as pending revalidation and
their vouchers drop into the review queue. The user reconfirms them in bulk
and the rule is reissued under the new fingerprint.

Rules are never physically deleted; they're revoked with `revoked_at`,
because the audit log ([ADR-013](013-bitacora-inmutable-y-bloqueo-de-periodo.md))
references whichever rule applied at the time.

## Consequences

### Positive
- Rules reflect the judgment of the person filing for that specific
  taxpayer, not a generic criterion imposed on them.
- A change in economic activity doesn't silently corrupt future periods.
- The history of revoked rules explains why an old period was calculated
  the way it was.

### Negative
- A change in economic activity dumps a lot of work back into the queue
  at once. Mitigated with bulk revalidation, but it's real, visible
  friction.
- The fingerprint is a hash: if the order or format of the activities
  changes without their content changing, rules get invalidated for no
  reason. **The fingerprint must be computed over normalized, sorted
  codes**, never over the raw text.

## Alternatives considered

**Key by supplier only, global across the system.** Much more coverage
from day one, but imposes one user's judgment on another in cases where
they legitimately differ. That idea survives, but as a **suggestion** in
the shared catalog ([ADR-007](007-modo-sin-ia-y-catalogo-compartido.md)),
not as a rule.

**Key by supplier and concept.** Was the original design. Not viable: the
source carries no concept.

**Ignore economic activity.** Simpler, and works as long as the taxpayer
doesn't change their line of business. Fails silently when they do, which
is exactly the kind of failure this product can't afford.
