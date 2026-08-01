# ADR 0002 — Stages, agents, patterns and guides are data, not code branches

Status: accepted

## Context

A 12-stage lifecycle with per-stage approvers, quorum, veto rights and exit criteria invites a
transition engine full of `switch (stage)` branches. That engine then becomes the place every change
lands, and the published RACI matrix drifts away from the enforced behaviour within a quarter.

## Decision

- `src/lib/lifecycle/stages.ts` holds all twelve stages as data: required artifacts, approver roles,
  quorum, veto roles, permitted agents, guide key and exit criteria as functions returning
  `CriterionResult[]`.
- `src/lib/agents/registry.ts`, `src/lib/patterns/registry.ts` and `src/lib/guides/registry.ts`
  follow the same shape.
- The transition engine reads the registry. It contains no stage-specific branch.
- The RACI matrix in Academy is *computed* from the stage registry, so it cannot drift from what the
  engine enforces.

## Consequences

- Adding a stage, agent, pattern or guide is a data change.
- Exit criteria are pure functions over a `StageContext`, so they are testable without a database and
  produce identical results for the UI checklist and for the engine at gate-open time.
- The registry file is long. That is the correct place for the length.
