# ADR-007: No-AI mode and shared supplier catalog

## Status
Accepted

## Date
2026-09-20

## Context

Given that SRI files carry no concept, the only thing an AI model
contributes in this system is **world knowledge about the supplier's
identity**: a rules engine doesn't know that `MEGADATOS S.A.` sells
internet services; a model does.

That's a real contribution, but a bounded one, and there are users for whom
sending their clients' data to a third party is unacceptable, whether by
their own policy or by contractual commitment to those clients.

Moreover, that same knowledge can be accumulated inside the system: if many
users classify the same supplier the same way, that consensus is a more
reliable signal than a model's inference, because it comes from
professionals deciding on real Ecuadorian suppliers.

## Decision

**Two complementary mechanisms.**

**1. No-AI mode is a first-class setting**, not a degraded mode. It's
enabled per account (`users.ai_enabled`). With AI off, the cascade runs
levels 1, 2, and 4. Nothing breaks, nothing blocks.

**2. Shared supplier catalog.** Global and **anonymous** aggregate: it
contains the supplier's RUC, the consensus category, the level of
agreement, and the number of observations. **It contains no taxpayer or
user identifiers.** The supplier isn't sensitive data for the buyer — the
relationship between buyer and supplier is, and that relationship never
enters the catalog.

A supplier only enters the catalog after crossing a threshold of
independent observations, and the catalog **suggests**, it doesn't decide:
below an agreement threshold, the voucher goes to the queue.

## Practical difference between the modes

| | With AI | Without AI |
|---|---|---|
| First period, new taxpayer | Few in the queue | Considerably more in the queue |
| Following periods | Minimal | Few |
| Final result | Identical | Identical |

Both converge to the same place. **AI isn't the engine: it speeds up the
cold start.**

## Usage measurement, not billing

AI usage is logged per account (`ai_usage`) to detect abuse, not to bill
for it. The measured cost — under $0.50 monthly for 80 taxpayers at steady
state — doesn't justify building metered billing. Plans are charged by
number of taxpayers and users
([ADR-003](003-usuario-como-tenant-con-tabla-de-union.md)).

## Data minimization toward the AI

When level 3 is active, the query contains only:

```
Buyer's economic activity: <code>
Regime: <regime>
Supplier: <legal name>
Amount: <value excluding taxes> | VAT: <iva>
```

**Neither the RUC nor the taxpayer's name is sent.** The model never
knows whose books these are.

This is data minimization, not anonymization — the supplier's identity is
irreducible because it *is* the classification signal. Calling it
anonymization in marketing material would be inaccurate.

## Consequences

### Positive
- No-AI mode is sellable as a stance, not a shortcoming.
- The catalog improves with the user base and, over time, should surpass
  AI in coverage of Ecuadorian suppliers.
- Turning AI off requires no alternate code path at all.

### Negative
- The shared catalog needs critical mass: during the first months it
  contributes little or nothing, and no-AI mode is genuinely more work.
- A systematic bias among early users propagates as apparent consensus.
  Mitigated by the agreement threshold and because the suggestion is
  always reviewable, but it's a real risk that needs watching.
- It has to be decided and clearly communicated that one user's
  classifications feed a shared aggregate, even if anonymous.
