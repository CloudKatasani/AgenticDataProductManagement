# ADR 0003 — Agent output is a proposal until a human acts on it

Status: accepted

## Context

"Agentic" usually means the agent writes into the artifact and a human reviews afterwards, if at
all. That is exactly the pattern this product exists to argue against.

## Decision

- Agent output persists as `AgentProposal` rows, never as artifact content.
- Acceptance requires an explicit human action: Accept, Edit & Accept, or Reject.
- Accepted proposals are folded into an artifact only at commit time, by a human, and every folded
  field carries `FieldProvenance` recording `AGENT_ACCEPTED` or `AGENT_EDITED`, the agent and the
  accepting user.
- An artifact cannot be submitted for review while any proposal for that stage is still `PENDING` —
  this is a named exit criterion, not a UI convention.
- Critic output is not written as a comment. It is a proposal; accepting it creates a comment
  authored by the accepting human, because attributing a comment to a person who did not write it
  would be a small lie in an audit trail whose whole value is that it does not contain any.
- Every invocation writes an `AgentAction` with agent, trigger, declared read scope, input hash,
  model, tokens, estimated cost, output and human disposition.
- `L3` is the ceiling and `L3` is read-only monitoring. A workspace setting may lower an agent's
  ceiling; it can never raise it.

## Consequences

- The honest answer to "can we turn on full automation?" is no, and it is enforced rather than
  promised.
- Agent telemetry — acceptance rate, edit rate, rejection count, cost per stage — falls out of the
  data model rather than needing separate instrumentation.
