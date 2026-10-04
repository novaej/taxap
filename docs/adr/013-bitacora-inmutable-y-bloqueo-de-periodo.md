# ADR-013: Immutable audit log and period lock

## Status
Accepted

## Date
2026-09-20

## Context

The initial plan stored the AI's confidence and reasoning in columns on
the voucher's own row. That means reclassifying overwrites the previous
value: what it said before, who changed it, and why are all lost.

For this product that's a serious gap. If the tax authority questions a
period two years later, there has to be an answer for **why** each
voucher was classified the way it was. A column holding the final state
doesn't answer that.

There's a second problem: once the user files the return with the SRI,
the data backing it shouldn't be able to change. If someone reclassifies
a voucher from an already-filed period, the system stops matching what
was filed, with no trace of the divergence.

## Decision

**Two mechanisms, both enforced in the database, not in the
application.**

**1. Immutable audit log.** `classification_events` records every
classification change: voucher, field, previous value, new value, who
(user or engine), under what source, under which rules version, and —if
it was AI— with which model and prompt version.

A trigger rejects `UPDATE` and `DELETE`. The table only grows.
Corrections are recorded as new events, never by modifying previous
ones.

**2. Period lock.** Setting `tax_periods.status` to `FILED` sets
`locked_at`. A trigger rejects any modification to vouchers in a locked
period. To correct something, the period is reopened explicitly — and
that reopening is itself a recorded event.

Both triggers live in PostgreSQL because the application isn't the only
path to the data: an administrative query, a maintenance script, or a
future import process must also respect them.

## Consequences

### Positive
- There's a citable answer to "why was it classified this way?", with
  author and date.
- A filed period can't diverge from what was submitted without leaving a
  trace.
- Immutability doesn't depend on the application code behaving well.
- The audit log is the natural basis for the per-field traceability the
  MVP calls for.

### Negative
- `classification_events` grows fast: several rows per voucher in the
  first period. It will need an archiving policy, though not in the MVP.
- The immutability triggers complicate tests and migrations: they have
  to be accounted for when cleaning up development data.
- Reopening a period is deliberate friction. If it turns out too
  cumbersome in real use, the temptation will be to relax it — and that's
  where the guarantee is lost. **The reopening flow has to be designed
  well, not left as an edge case.**

## Alternatives considered

**Status columns on the voucher, no audit log.** Was the initial plan.
Simpler and sufficient for showing the current screen, but it doesn't
answer any question about the past.

**Audit log in the application, no triggers.** Works as long as all
access goes through the application. The first maintenance script that
touches the database breaks the guarantee exactly when it's needed most.

**Full row versioning.** More complete, and much heavier. The per-field
audit log covers the real question — what changed in the classification —
at a fraction of the cost.
