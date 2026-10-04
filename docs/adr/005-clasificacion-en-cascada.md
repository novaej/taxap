# ADR-005: Four-level classification cascade

## Status
Accepted

## Date
2026-09-20

## Context

The initial plan proposed sending every purchase to an AI model for
classification. Two problems, neither about cost:

**Inconsistency across periods.** A language model might classify the same
supplier one way in March and another way in April. For the person filing,
that's unacceptable: April's filing has to be consistent with March's.

**Irreproducibility.** If the SRI questions a period two years later, there
has to be an explanation for why each voucher was classified the way it
was. "A model that no longer exists decided it" is not an answer.

Additionally, SRI files **carry no concept or description**
([ADR-008](008-solo-totales-sin-detalle-de-lineas.md)). The only real signal
is the supplier's identity. With the same identity and the same context, the
correct answer is always the same — which makes a deterministic mechanism
naturally fitting.

## Decision

**A four-level cascade.** Each voucher falls through until one level
resolves it. Only vouchers with `IVA > 0` enter.

| Level | Mechanism | Deterministic | Cost |
|---|---|---|---|
| 1 | Learned rule for (taxpayer, supplier, activity) | Yes | 0 |
| 2 | Shared supplier catalog | Yes | 0 |
| 3 | AI — **optional** | No | ~$0.001 per new supplier |
| 4 | Manual review queue | Human | User's time |

**The feedback loop is the point:** every level-4 decision writes a
level-1 rule. What the user corrects today, the system knows next month.

The AI query is **per supplier, not per voucher**. A period with 180
vouchers from 60 distinct suppliers generates at most 60 queries in the
first month, and a handful afterward.

Every classification records `classification_source`, `rules_version`, and
— when it comes from AI — `model_id` and `prompt_version`, so any verdict
can be explained later.

## Consequences

### Positive
- The same supplier is classified the same way every period, by
  construction.
- Every verdict has a citable origin.
- The system improves with use instead of costing the same every month.
- Level 3 can be turned off entirely without breaking anything
  ([ADR-007](007-modo-sin-ia-y-catalogo-compartido.md)).

### Negative
- Four mechanisms to maintain instead of one.
- Each taxpayer's first period is laborious: with no rules of their own,
  almost everything depends on levels 2, 3, and 4.
- A wrong rule silently propagates to every following period. That's why
  rules are revocable, recorded with author and date, and the per-field
  breakdown makes the error detectable.

## On cost

Measured because the initial argument overstated it:

| Scenario | Approximate cost |
|---|---|
| Query for a new supplier | ~$0.001 |
| New taxpayer, first period | ~$0.06 |
| 80 taxpayers, steady state | < $0.50 / month |

**Savings are not the reason for this decision.** Even sending every
voucher to the AI, the cost would be irrelevant next to the
infrastructure. The reasons are consistency and reproducibility.

## Alternatives considered

**AI on every voucher.** Simpler to build. Discarded due to inconsistency
across periods and irreproducibility under review.

**Rules only, no AI and no catalog.** Fully deterministic, but each
taxpayer's first period forces manually classifying every supplier, and the
product stops saving work exactly when the user is evaluating it.
