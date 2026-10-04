# ADR-011: Resumable two-step ingestion and classification

## Status
Accepted

## Date
2026-09-20

## Context

A job queue (pg-boss or similar) was initially considered for processing
the upload, assuming high per-file processing volume.

Reviewing real SRI files, that assumption turned out to be false. They're
tab-separated TXT files with one row per voucher and eight to twelve
columns. Parsing thousands of rows takes seconds, and classification
queries the AI **per supplier, not per voucher**
([ADR-005](005-clasificacion-en-cascada.md)): dozens of queries, not
thousands.

A real risk remains: if the HTTP request gets cut off halfway through —
a timeout, a deploy, the user's network — what happens to what's already
been processed?

## Decision

**No job queue. Two separate steps, each idempotent.**

**Step 1 — Ingestion.** Synchronous. Parses, validates, deduplicates by
access key ([ADR-009](009-clave-de-acceso-como-clave-de-deduplicacion.md))
and inserts with `processing_status` unclassified. Seconds. If something
fails afterward, nothing is lost: the vouchers are already saved.

**Step 2 — Classification.** Takes the period's unclassified vouchers,
runs them through the cascade, and marks them. **Resumable**: running it
again continues where it left off, with no duplicated work and no
re-querying the AI for already-resolved suppliers. The user triggers it
explicitly and can repeat it with no consequences.

Resumability comes from the fact that the state lives in the voucher row,
not in memory or in a queue message. No infrastructure is needed to know
where the process left off: it's enough to query what's still
unclassified.

## Consequences

### Positive
- No additional infrastructure: no Redis, no broker, no worker process.
- An interruption never leaves the period in an inconsistent state.
- The user has explicit control: upload, review what was loaded, classify.
- Separating the steps leaves the door open to a queue later without any
  redesign — step 2 is already a resumable unit of work.

### Negative
- Step 2 runs inside an HTTP request and may approach timeout limits with
  a large first period and many new suppliers. Mitigated by processing in
  batches and returning control, but **it has to be measured with a real
  period before accepting this decision as good.**
- No automatic retry. If step 2 fails, the user has to trigger it again.
  Acceptable because it's resumable and the action is explicit.
- Without a queue there's no concurrency control: two simultaneous runs
  of step 2 on the same period can duplicate AI queries. Resolved with a
  PostgreSQL advisory lock per period, not with new infrastructure.

## Alternatives considered

**pg-boss.** A queue on the same PostgreSQL instance, no extra
infrastructure and transactional with the data. Was the initial
recommendation, made under the wrong assumption of heavy processing.
Still the first option **if measurement shows step 2 doesn't fit in a
request.**

**BullMQ with Redis.** More capacity and better retries, in exchange for
one more service to operate. Disproportionate for this volume.
