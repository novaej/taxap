# ADR-003: The user is the tenant, with a join table

## Status
Accepted

## Date
2026-09-20

## Context

There are two user profiles, and it isn't clear they need different
structures:

- A **natural person** who files their own return: a taxpayer.
- An **accountant** who manages several clients: N taxpayers.

The initial proposal introduced an `organizations` entity between the user
and the taxpayers, to support firms with several accountants sharing
clients.

That adds a concept that 100% of the MVP's intended users don't need, and
that has to be explained in the UI or hidden behind special cases. There's no
validated demand for multi-user firms.

What's genuinely expensive is getting it wrong in the other direction:
migrating from "the user is the tenant" to "the organization is the tenant"
means rewriting every RLS policy and re-parenting every taxpayer, with real
data in production.

## Decision

**The user is the tenant.** There is no organization entity.

But taxpayers are linked through a **join table from day one**:

```
users ──< user_taxpayers >── taxpayers
```

- Today every taxpayer has exactly one row, with `access = OWNER`.
- The concept of "sharing" doesn't exist in the UI.
- Tomorrow, adding a collaborator is an `INSERT`, not a migration.

Plans are defined by **two** limits: number of taxpayers and number of
users. The second is 1 on every current plan, but the column exists.

The role (`INDIVIDUAL` / `ACCOUNTANT`) is changeable: a natural person who
starts doing bookkeeping for others switches plans, and that only changes a
numeric limit — it doesn't restructure anything.

## Consequences

### Positive
- One less concept in the model, and zero in the UI.
- RLS is a single policy on `app.current_user_id`, with no branches.
- The audit log always knows which person made each decision, because
  nobody shares credentials for lack of an alternative.
- Enabling multi-user firms later doesn't require a data migration.

### Negative
- The join table is an indirection that adds no functional value today.
  Every taxpayer query goes through a `JOIN` or an `EXISTS` that a direct FK
  wouldn't need.
- The RLS policy on child tables uses a subquery instead of comparing a
  column. It requires an index on `user_taxpayers(taxpayer_id)`.

## Alternatives considered

**Direct FK `taxpayers.user_id`.** The simplest option, and the correct one
if there are never firms with multiple employees. Discarded because the cost
of keeping the door open is one table, and the cost of opening it later is a
migration with production tax data.

**`organizations` entity from the start.** Supports firms from day one, but
introduces a concept no MVP user needs and forces creating single-member
phantom organizations for natural persons.
