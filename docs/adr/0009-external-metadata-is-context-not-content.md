# ADR 0009 — Imported external metadata is agent context, never artifact content

Status: accepted

## Context

Most organisations adopting ADPM already run a data modelling tool (erwin) and a catalogue
(Collibra, Alation). Those tools already hold entities, relationships, column profiles, glossary
terms and metric definitions. An agent that proposes a logical model without knowing the
enterprise already models `Account` that way is worse than useless — it invents a competing answer
and a human has to reconcile it.

So agents should have that context. The question is what "having it" means, and there are three
candidate answers:

1. **Import becomes artifact content.** The catalogue's entities land in the logical model.
2. **Import becomes an agent proposal.** Each imported fact is a proposal a human dispositions.
3. **Import becomes agent context.** Agents read it; their proposals still need disposition.

## Decision

**Option 3.** An import is stored as an append-only, content-hashed `ExternalMetadataImport` and is
read by agents that declared the relevant slice in `externalScope`. It never becomes an artifact
version.

Option 1 is straightforwardly wrong: it routes third-party assertions into committed artifacts with
no human in the path, breaking invariant 5.

Option 2 is defensible and was the harder call to reject. It was rejected because it makes the
volume unusable — a catalogue export is thousands of columns, and a human dispositioning each one
is not review, it is data entry with a rubber stamp. Rubber-stamped review is worse than no review,
because it produces a record that says a human checked when nobody did. Context feeding better
proposals preserves the property that matters: **the thing a human accepts is still a small,
specific, argued proposal.**

Three consequences follow, each enforced:

- **Declared scope covers external context.** `externalScope` sits beside `readScope` on the agent
  definition, is recorded on every `AgentAction`, and is part of the input hash. Invariant 6 does
  not care whether context came from an artifact or a catalogue.
- **The grounding agent gets none of it.** Catalogue imports are full of physical Bronze and Silver
  table names; invariant 7 says a grounding artifact may reference only certified semantic-layer
  objects. The surest enforcement is that the grounding agent never sees them.
- **External certification stays external.** A catalogue calling an asset "Certified" is carried as
  `externalCertification`, verbatim, and never mapped onto ADPM's certification, which requires
  cited evidence and a recorded approval (invariant 8).

## Import-only, file-based, no live sync

Every connector is file-based: export from your tool, upload the file. There is deliberately no
live API sync.

- CLAUDE.md §4 requires the application to run offline on a laptop. Once an agent depends on a
  reachable Collibra instance, that stops being true for a core flow.
- One-way import means ADPM cannot write back to a system of record it does not own. It cannot
  corrupt your catalogue because it has no path to.
- A live connector that has never been run against a real instance is a claim, not a feature. None
  of these have been.

The canonical format is ADPM's own schema, fully specified and round-trip tested. The erwin,
Collibra and Alation adapters map documented export shapes onto it and say plainly in the UI that
they are unverified against a live instance — the same honesty split used for standards adapters
in ADR 0006. Any tool that can emit the canonical shape needs no adapter at all.

## Consequences

- Agents at Stages 3, 4, 5 and 6 give materially better guidance when a catalogue is present, and
  identical guidance when it is not. Guardrail 8 — every stage completable with nothing connected —
  survives, and is tested.
- The local heuristic provider reads the imported context too, so the benefit is demonstrable
  offline with no API key. A feature only visible with a paid key would not be checked by anyone.
- Import volume is unbounded and goes into an agent's context window. Today the merge is
  newest-wins per key with no size cap; a very large catalogue export could produce a context that
  is expensive or truncated. Capping and relevance-ranking imports is unimplemented.
- Nothing here maps external identifiers to ADPM artifact fields automatically. A human still
  decides that an imported `Account` entity is the same `Account` this product means.
