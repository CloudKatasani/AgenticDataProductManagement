# ADR 0006 — What "standards support" is allowed to mean here

Status: accepted

## Context

Interoperability claims are cheap to make and expensive to verify. Published specifications evolve,
and an adapter written from memory can be subtly wrong in ways nobody notices until an import fails
at a client.

## Decision

- Every adapter pins the specification version it was written against, exposed in
  `STANDARDS_ADAPTERS` and surfaced in the Admin UI.
- ODCS and MetricFlow are implemented as genuine round trips (`toX` / `fromX`) with tests asserting
  that a payload survives the round trip unchanged.
- The remaining adapters are declared **export only** and labelled as such, including
  OpenMetadata/DataHub, where a live sync would imply this tool owns your catalogue. It does not.
- The README and the Admin UI both state plainly that a pinned version plus a passing round-trip test
  means the mapping is stable and tested — not that it has been certified against a live published
  specification.

## Consequences

- No conformance claim in this repository is stronger than the test that backs it.
- Verifying an adapter against the current published specification is a known, named piece of
  outstanding work rather than an assumption.
