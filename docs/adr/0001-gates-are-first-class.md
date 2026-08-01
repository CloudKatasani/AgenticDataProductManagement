# ADR 0001 — Gates are first-class entities, and one function approves them

Status: accepted

## Context

The obvious shortcut is a `status` enum on the data product: `stage_5_approved`, and so on. It is
one column, it is easy to query, and it is what most workflow tools do.

It also makes the central claim of this product unverifiable. If approval is a column, then any
route handler, any seed script, any well-meaning admin action can set it. There is then no honest
answer to "can an agent approve a gate?" — only a promise.

## Decision

`Gate` is a first-class entity holding stage number, required roles, quorum, veto roles, decisions,
timestamps, staleness reason and a snapshot of the evidence the approval rested on.

`recordDecision()` in `src/lib/lifecycle/transitions.ts` is the only code path that may set
`Gate.state = 'APPROVED'`. The function that writes it is private to that module.
`tests/gate-engine.test.ts` scans the source tree and fails if any other file writes that literal.

Quorum and veto arithmetic is extracted into `evaluateGateOutcome()`, a pure function, so the rules
can be read and tested without a database.

## Consequences

- Seeding cannot shortcut the engine. `prisma/seed.ts` drives all 27 demo products through the real
  transitions, so a broken engine fails the seed rather than producing plausible-looking demo data.
- Adding a gate rule means changing one function, and the test that guards it.
- Queries for "which stages are approved" cost a join rather than a column read. Acceptable.
