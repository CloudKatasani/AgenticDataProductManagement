# Agentic Data Product Management (ADPM)

A locally hosted, industry-agnostic web application for managing the full lifecycle of data
products — from a business user's unmet decision need through design, certification, publication,
consumption and retirement.

> **Agents act. Humans decide.**
> Agents research, profile, draft, cross-check, critique and monitor. They produce proposals,
> findings and alerts. They never approve a gate, never commit an artifact version, never publish,
> and never satisfy an exit criterion on their own authority. There is no configuration, autonomy
> level or admin override that changes this.

---

## Five-minute quickstart

```bash
pnpm install          # installs dependencies and generates the Prisma client
pnpm db:seed          # creates the SQLite database and seeds 9 workspaces, 27 certified products
pnpm dev              # http://localhost:3000
```

Sign in with any seeded account and the password `adpm`:

| Email | Role | Lands on |
|---|---|---|
| `consumer@adpm.local` | Data Consumer | Marketplace |
| `owner@adpm.local` | Domain Product Owner | My Work |
| `steward@adpm.local` | Data Steward | My Work |
| `privacy@adpm.local` | Privacy & Security Officer | My Work |
| `cdo@adpm.local` | Portfolio Lead / CDO | Portfolio |
| `admin@adpm.local` | Admin | Admin |

The full list is on the sign-in screen.

**Nothing else is required.** No cloud service, no warehouse connection, no API key. Agents are
disabled by default and, where enabled, fall back to a deterministic local heuristic provider that
makes no network call at all.

### The seeded demo

`pnpm db:seed` drives every demo product through the **real** transition engine — the same
`requestTransition()` and `recordDecision()` calls the UI makes. If the engine is broken, the seed
fails. It produces:

- 9 workspaces, one per industry pack, with one user per role in each
- 27 data products, each certified and published through all 12 gates (324 approved gates)
- ~675 content-hashed artifact versions and ~2,350 append-only audit events
- A cross-industry marketplace, an intake queue with a breached triage target, a declined request
  with its reason visible to the requester, and an open change request

---

## What it does

### Three front doors, never blended

| Door | Who | Entry point |
|---|---|---|
| **Consumer** | Business user, analyst, executive | **Marketplace** → search, then **Request** if nothing answers the question |
| **Practitioner** | Product owner, steward, SME, architect, engineer, privacy officer | **My Work** → **Lifecycle Studio** |
| **Leadership** | CDO, domain lead, programme director | **Portfolio** |

### The nine tabs

Marketplace · Request · My Work · Lifecycle Studio · Portfolio · Consumption Patterns · Agents ·
Academy · Admin.

### The twelve stages

1. Consumption Discovery · 2. Charter & Value Case · 3. Source Discovery & Profiling ·
4. Conceptual & Logical Model · 5. Attribute Register & Data Contract · 6. Semantic Model & Metrics ·
7. Physical Architecture · 8. Quality & Observability · 9. Access & Governance ·
10. Serving & Consumption · 11. Certification & Publication · 12. Operate, Evolve & Retire

Every stage carries the same furniture: a "why this stage matters" panel, a live exit-criteria
checklist, an agent panel, a review thread anchored to fields, version diff, parking lot, gate
panel and audit timeline.

---

## The invariants, and where they are enforced

| # | Invariant | Enforced in | Tested in |
|---|---|---|---|
| 1 | Consumption-first: Stage 2 is hard-blocked until Stage 1 is approved | `lib/lifecycle/stages.ts` | `tests/criteria.test.ts` |
| 2 | `recordDecision()` is the only path to an APPROVED gate | `lib/lifecycle/transitions.ts` | `tests/gate-engine.test.ts` (source scan) |
| 3 | Artifact versions are content-hashed and append-only | `lib/artifacts/commit.ts` | `tests/lifecycle.test.ts` |
| 4 | Cascade honesty: changed evidence flips approvals to STALE | `lib/lifecycle/cascade.ts` | `tests/lifecycle.test.ts` |
| 5 | An artifact cannot be submitted while a field is unreviewed agent output | `lib/lifecycle/criteria.ts` | `tests/agent-guardrails.test.ts` |
| 6 | Every agent invocation writes an auditable `AgentAction` | `lib/agents/runtime.ts` | `tests/agent-guardrails.test.ts` |
| 7 | Grounding purity: no Bronze or Silver reference survives the validator | `lib/lifecycle/stages.ts` (Stage 10) | `tests/criteria.test.ts` |
| 8 | Evidence over assertion: every certification dimension cites a resolving reference | `lib/lifecycle/stages.ts` (Stage 11) | `tests/criteria.test.ts` |
| 9 | Value closes the loop: hypothesis at Stage 2, measured at Stage 12 | `lib/lifecycle/stages.ts` | `tests/criteria.test.ts` |
| 10 | Roles are re-derived server-side on every mutation | `lib/auth/authorise.ts` | `tests/lifecycle.test.ts` |
| 11 | Industry logic lives in packs, never in application code | `packs/*.yaml`, `lib/packs/` | `pnpm pack:validate` |

Quorum and veto arithmetic is a pure function (`evaluateGateOutcome`) so the rules can be read and
tested without a database. Two rules worth stating explicitly:

- A **reject from a veto role rejects the gate outright**, regardless of quorum.
- **Silence from a veto holder is not consent** — if a veto role is also an approver role, the gate
  cannot pass until they have approved.

---

## Commands

```bash
pnpm dev            # development server
pnpm build          # production build (runs prisma generate first)
pnpm start          # serve the production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint, zero warnings tolerated
pnpm test           # vitest — unit + integration against a separate SQLite file
pnpm test:e2e       # playwright, against a running server (see below)
pnpm pack:validate  # validate every industry pack
pnpm db:seed        # create and seed the database
pnpm db:reset       # drop and reseed
```

End-to-end tests expect a built server on port 3111 with the seeded database:

```bash
pnpm db:seed && pnpm build
PORT=3111 pnpm start &
pnpm test:e2e
# If your environment ships a Chromium that does not match this Playwright version:
# PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e
```

---

## Agents

Twelve chartered agents, each declaring a stage binding, a read scope, an output type, an autonomy
ceiling and an escalation rule (`src/lib/agents/registry.ts`).

| Level | Name | Behaviour |
|---|---|---|
| **L0** | Off | Never runs |
| **L1** | Suggest *(default)* | Runs only when invoked; proposes field by field |
| **L2** | Draft | Runs on a stage-entry trigger; produces a whole-artifact draft |
| **L3** | Monitor | Runs on a schedule against published products; raises findings. **Never edits an artifact.** |

There is deliberately **no level that clears a gate or commits a version**. A workspace setting can
lower an agent's ceiling; it can never raise it.

**Providers.** Model access sits behind an adapter:

- `local-heuristic` (default) — deterministic, rule-based, no network call. Labelled as such
  everywhere it appears. This is what makes the whole lifecycle demonstrable offline.
- `anthropic` — used when an API key is configured in Admin. Keys live in the environment or a
  git-ignored local file, never in the database and never in a committed artifact.

Before transmission, values flagged as PII or restricted in the attribute register are redacted, and
sample data is withheld unless the workspace explicitly allows it. The redacted field count is
reported back in the UI after every run.

---

## Packs

Nine packs ship: `_generic`, utility/energy (the reference implementation), banking, insurance,
retail/CPG, healthcare, manufacturing, telecom and public sector. Each supplies domains, a conformed
backbone, canonical entities, a control library, starter metrics, sample decision records, platform
profiles, a glossary, blueprints and seed marketplace products.

**Packs are illustrative and editable, not authoritative.** They are a starting point for a
conversation with your own regulatory and domain experts. They are not legal advice and not a
compliance certification. The UI says so on every pack screen.

---

## Exports

- **Word** — evidence pack (every artifact version, approval, provenance summary), maturity assessment
- **Excel** — attribute register (colour-coded inputs, dropdown validation, locked reference sheet,
  COUNTIFS review summary, parking-lot tab), portfolio extract
- **YAML / JSON** — every stage artifact, marketplace listing, grounding pack, standards payloads
- **Mermaid** — ER, lineage and portfolio dependency graphs, generated from committed artifacts
- **PDF** — the printable "How data products work here" primer
- **Audit bundle** — every gate, decision, artifact version and agent action, digest-sealed

Every committed artifact is also mirrored to `workspace/` as plain YAML or Markdown, so the whole
programme is git-diffable outside the application.

---

## Standards interoperability

| Standard | Version pinned | Direction |
|---|---|---|
| Open Data Contract Standard (ODCS) | v3.0.x | round-trip |
| Open Data Product Specification (ODPS) | v3.x | export |
| DCAT / DCAT-AP | DCAT 3 JSON-LD | export |
| OpenLineage | 2-0-2 run event | export |
| MetricFlow / dbt semantic manifest | semantic manifest v1 | round-trip |
| schema.org `Dataset` | schema.org 27.x | export |
| OpenMetadata / DataHub | listing export shape | export only, no live sync |

**Be precise about what this claims.** Each adapter pins the version it was written against and is
covered by a round-trip or shape test in `tests/standards.test.ts`. That means the mapping is stable
and tested — **not** that it has been certified against a live published specification. The
specifications evolve; check the pinned version against the current published spec before relying on
one of these in production. This limitation is repeated in the Admin UI rather than hidden here.

---

## Anti-goals — things this deliberately is not

- **Not a pipeline builder, query engine, or anything that executes transformations.** ADPM designs,
  governs and manages data products; it does not run them.
- **No live warehouse dependency in any core flow.** Stage 3 profiling accepts entered or uploaded
  statistics; it never requires a connection.
- **No agent that can approve, commit, publish or complete a stage.** No exceptions, no override.
- **No single blended navigation** across consumer, practitioner and leadership.
- **Gates are not a status enum on a product.** They are first-class entities with roles, quorum,
  veto, decisions, evidence snapshots and an audit trail.
- **No industry logic in application code.** If it names an industry, a domain, a regulation or an
  entity, it belongs in a pack.
- **No prioritisation score that cannot be overridden** by a named human with a recorded reason.
- **No claimed standards conformance without a round-trip test** against the pinned specification.

A tool that is honest about its boundary is more credible in an enterprise procurement conversation
than one that claims everything.

---

## Honest limitations in this build

- **Guided tours are content, not a driven overlay.** The Academy ships the tour scripts and links
  each step to the real screen; it does not yet drive the UI with a persistent overlay.
- **Peer-band comparison in the maturity assessment is a placeholder.** No external benchmark data is
  bundled, and inventing one would be dishonest.
- **The audit bundle is digest-sealed, not cryptographically signed** by an external key holder. The
  bundle says so in its own payload.
- **Excel round-trip is export-plus-import-shape, not a full re-import flow.** The workbook is
  generated with validation, review summary and parking lot; re-importing an edited workbook is not
  wired into the commit path in this build.
- **CSV upload for Stage 3 profiling is not wired to a file picker.** Profile statistics are entered
  or committed as an artifact; the schema and criteria support either source.
- **Scheduled L3 monitoring runs on demand**, from the Agents tab, rather than from a background
  scheduler.
- **Standards adapters are tested against their pinned shapes**, not against a live specification —
  see above.

---

## Architecture

```
src/
  app/                        # Next.js App Router — one route per tab, server actions for mutations
  lib/
    lifecycle/stages.ts       # the 12-stage registry AS DATA (roles, quorum, veto, exit criteria)
    lifecycle/transitions.ts  # requestTransition / recordDecision — the only gate paths
    lifecycle/criteria.ts     # pure exit-criteria evaluators
    lifecycle/cascade.ts      # approval decay when evidence changes
    artifacts/                # Zod schemas, commit.ts, diff.ts, serialise.ts
    agents/                   # registry (charters AS DATA), runtime, providers, redaction
    patterns/registry.ts      # the eight consumption patterns AS DATA
    guides/registry.ts        # the teaching layer AS DATA
    packs/                    # loader, validator, blueprint expansion
    portfolio/                # scoring and maturity models
    standards/                # ODCS, ODPS, DCAT, OpenLineage, MetricFlow, schema.org adapters
    exports/                  # docx, xlsx, pdf, audit bundle
prisma/                       # schema and the seed that drives the real engine
packs/                        # nine industry packs (YAML)
workspace/                    # git-friendly mirror of committed artifacts
tests/                        # vitest unit + integration, playwright e2e
docs/adr/                     # architecture decision records
```

Registries are data. Adding a stage, agent, pattern, pack or guide never requires editing the
transition engine.
