# ADR 0005 — A deterministic local provider sits alongside the model provider

Status: accepted

## Context

Agents are optional and disabled by default, and they need a user-supplied API key. But the entire
supervised-autonomy loop — propose, disposition, provenance, audit — is the product's central claim,
and a claim nobody can see without a credit card is a claim nobody checks.

## Decision

Model access sits behind an `AgentProvider` adapter with two implementations:

- `local-heuristic` — deterministic, rule-based, offline. It derives real proposals from the
  artifacts already committed (null-rate gaps from the profile report, untraced metrics from the
  semantic model against the Stage 1 questions, unclassified attributes, Bronze/Silver grounding
  violations, DATSIS citations from actual evidence references).
- `anthropic` — used when an API key is configured.

The UI names which one ran, every time, in the agent panel and in the action log. The local provider
is never described as a language model.

## Consequences

- The whole lifecycle is demonstrable with no network access and no key.
- The guardrail tests exercise the real runtime rather than a mock.
- The heuristics are rules, and rules are narrower than a model. The UI is explicit about that rather
  than letting a demo imply more capability than is present.
