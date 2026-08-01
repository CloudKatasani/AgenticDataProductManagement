# Claude Code Kickoff Prompt — Agentic Data Product Management (ADPM)

> **How to use this.** Create an empty directory. Put `CLAUDE.md` in the root. Paste everything
> below the line into Claude Code. Work through it **phase by phase** — do not one-shot the
> application. Claude Code stops at the end of each phase and waits for your confirmation.

---

`CLAUDE.md` is in the repo root. Read it first and treat it as binding for everything that follows.
If anything below conflicts with it, flag the conflict rather than resolving it silently.

---

## 1. What we are building

**Agentic Data Product Management (ADPM)** — a locally hosted, enterprise-grade, industry-agnostic
web application for managing the full lifecycle of data products, from a business user's unmet
decision need through design, certification, publication, consumption and retirement, with **AI
agents doing the work and humans making every decision**.

The application exists to solve one problem: **organisations build data assets that nobody asked
for, nobody trusts, and nobody can find — and now they are adding AI on top of that same
foundation.** ADPM makes it structurally impossible to build a data product without first naming the
consumer, the decision they cannot make today, and the human who signed off on every design choice
along the way.

It must work simultaneously as four things:

1. **A working system** — real intake, real gates, real artifacts, real agents, real exports.
2. **An operating model made executable** — roles, RACI, prioritisation, and value tracking are
   in the product, not in a slide deck alongside it.
3. **A teaching instrument** — a client who has never built a data product can open it cold and
   understand the discipline in an afternoon.
4. **A demo asset** — pre-populated with a cross-industry marketplace so the first screen a
   stakeholder sees is credible, not empty.

**Success looks like:** a business user submits a request on Monday describing a decision they are
blocked on; a product owner triages it; agents draft, profile, critique and monitor while humans
review and approve at twelve gates; and the organisation ends with a certified, published,
adopted data product, a signed evidence pack, and a measured answer to "did this return the value we
claimed?" — with no point at which a human review could have been skipped.

## 2. The design thesis

Five commitments. Every design decision resolves back to one of them. Put them on the landing page.

1. **Consumption-first, not pipeline-first.** The entry point is a blocked decision, never a source
   system. Architecture is the answer to a consumption question, not the question itself.
2. **Supervised autonomy.** Agents act; humans decide. Maximum agent leverage, zero unaccountable
   decisions. The gate is the unit of accountability.
3. **One metric, one definition, one answer.** The semantic layer is the fulcrum: a metric defined
   once and enforced identically across dashboards, self-serve, conversation, agents and APIs.
4. **Evidence, not assertion.** Certification cites artifact versions and approvals. Trust is
   demonstrated, not badged.
5. **Value closes the loop.** A value hypothesis at charter, measured at operate. Products that
   never returned value are visible in the portfolio, not quietly forgotten.

## 3. The three front doors

The single most important structural idea in the application. Build the information architecture
around it, and never blend them — different navigation, different density, different vocabulary.

**Door A — The consumer** (business user, analyst, executive). Arrives at the **Marketplace**.
Searches for a product that answers their question. Either it exists (view detail, trust signals,
supported consumption patterns, request access) or it does not (click **Request a data product** and
describe the decision they cannot make today). They never see a Prisma model, a medallion layer, or
a YAML file.

**Door B — The practitioner** (product owner, steward, SME, architect, engineer, privacy officer).
Arrives at their **Inbox**: approvals pending on them, stages they own, comments awaiting reply,
stale gates, agent proposals awaiting disposition. From there into the **Lifecycle Studio**.

**Door C — Leadership** (CDO, domain lead, programme director). Arrives at **Portfolio**: pipeline,
prioritisation, capacity, spend, adoption, value realised, capability maturity. They should be able
to answer "what are we building, why that order, what did the last ten cost, and what did they
return?" without asking anyone.

## 4. Top-level navigation

Nine tabs in five groups. This is the required IA.

| Group | Tab | Purpose |
|---|---|---|
| Consume | **Marketplace** | Browse and search published products across all industries. Filter by industry, domain, archetype, tier, consumption pattern, quality score, freshness, access tier. Detail page assembled entirely from committed artifacts. "Products like this" via shared entities and conformed-backbone overlap. |
| Consume | **Request** | Guided intake wizard, duplicate detection, my requests, respond to clarification threads. |
| Build | **My Work** | Personal inbox: approvals, owned stages, open comments, stale gates, agent proposals awaiting disposition. Default landing page for practitioner roles. |
| Build | **Lifecycle Studio** | The 12-stage workbench: stage navigator, artifact authoring, agent assist, review threads, gate panel, version diff, parking lot, audit timeline. |
| Lead | **Portfolio** | Pipeline and roadmap, prioritisation scoring, domain heatmap, dependency and reuse graph, cost-to-serve, adoption, value realisation, capability maturity assessment. |
| Enable | **Consumption Patterns** | The eight named ways a product gets consumed, what each requires, and a per-product readiness matrix. |
| Enable | **Agents** | Agent registry and charters, autonomy configuration, supervision queue, action log, acceptance-rate telemetry, cost. |
| Enable | **Academy** | Guided tours, per-stage explainers, role guides, glossary, worked example, common failure modes, printable primer. |
| Run | **Admin** | Packs, roles and assignment, control and regulatory library, standards interoperability, agent configuration, export templates, seed/reset. |

## 5. Core mental model

Seven nouns carry the whole application.

- **Product Request** — a consumer-submitted intake record with its own triage workflow. Becomes a
  Data Product *only* when a Domain Product Owner approves it. Never let a request silently become a
  product.
- **Data Product** — the unit of work, moving through 12 stages.
- **Artifact** — a versioned, content-hashed, schema-validated document produced at a stage.
  Immutable once committed; edits create new versions.
- **Gate** — the approval checkpoint between stages: approver roles, quorum, veto rights, decisions,
  audit trail. **Gates are the reason this application exists — build them first-class, never as a
  status field on the product.**
- **Agent** — a chartered, scoped, auditable AI worker that produces proposals and findings.
- **Pattern** — a named consumption mode with its own artifact requirements and guardrails.
- **Guide** — the teaching content bound to every stage, pattern and role, held as data.

Everything else — packs, exports, marketplace, portfolio scoring — is scaffolding around those seven.

## 6. Personas, roles and RACI

Seed one user per role. Role assignment is per-workspace and per-domain.

| Role | Door | Owns | Veto |
|---|---|---|---|
| **Data Consumer** | A | Requests, feedback, ratings, access requests | — |
| **Domain Product Owner** | B | Triage, charter, value case, roadmap position | Stage 2, 11 |
| **Data Steward** | B | Attribute definitions, classification, quality rules, glossary | Stage 5, 8 |
| **Domain SME** | B | Business meaning, decision context, source truth, metric semantics | — |
| **Data Architect** | B | Model, grain, keys, identity resolution, physical architecture | Stage 4, 7 |
| **Data / Platform Engineer** | B | Ingestion, transformation, orchestration, serving | — |
| **Privacy & Security Officer** | B | Classification completeness, access policy, regulatory mapping | **Stage 9 (hard)** |
| **Semantic Steward** | B | Certified metrics, name uniqueness, grounding pack integrity | Stage 6, 10 |
| **Governance Council** | B | Certification, publication, retirement | Stage 11, 12 |
| **Portfolio Lead / CDO** | C | Prioritisation, capacity, spend, value realisation | — |
| **Admin** | — | Packs, roles, configuration | — |

Quorum, veto and required-role configuration live in the stage registry **as data** — never in `if`
statements inside the transition engine. Render the RACI as a generated matrix in Academy, computed
from the registry rather than typed by hand, so it can never drift from the enforced behaviour.

## 7. Intake and triage (Stage 0)

Model this as a **separate `ProductRequest` entity with its own state machine**, not as a lifecycle
stage. Most requests never become products, and the artifact-and-gate machinery is far too heavy for
triage.

**States:** `DRAFT → SUBMITTED → IN_TRIAGE → INFO_REQUESTED → (APPROVED | DECLINED | MERGED | DEFERRED)`

**The intake wizard** — five short screens, plain language, zero jargon:

1. **The decision** — "What decision are you trying to make that you can't make today?" Required.
2. **You and your team** — who is blocked (a named role, never "the business"), how many people, how
   often the decision recurs, the current workaround, how long it takes today.
3. **The questions** — the specific questions you would ask if you had the data. Minimum three.
   These become Stage 1 seed content and, later, the trace target for every certified metric.
4. **The stakes** — what happens if the decision is not made or is made badly. Quantified where
   possible: cost, risk, revenue, compliance exposure, customer impact.
5. **Constraints** — required freshness, preferred consumption pattern (from the eight), known
   sensitivity or regulatory concern.

**Duplicate detection** runs before final submit, against published products and open requests, using
shared entities, domain and question similarity. Show near-matches to the requester: "Three existing
products may already answer this." This is the primary defence against catalogue sprawl and it is a
real feature, not a nicety.

**Triage** (Domain Product Owner): request, near-matches, agent-produced complexity and value
indicators, and four actions — **Approve** (instantiates a Data Product at Stage 1 with the decision
register pre-populated from intake answers), **Request more information** (returns to the requester
with anchored questions and an in-thread reply loop), **Decline** (written reason, visible to the
requester), **Merge** (attach as an additional consumer to an existing product or request).

Every action writes an `AuditEvent`. The requester can see full status history of their own requests
at all times — opacity here is what kills intake processes in real organisations.

**Service levels.** Triage carries a target response time, configurable per workspace, with ageing
indicators and breach reporting into Portfolio. An intake process without a published SLA is a
suggestion box.

## 8. The 12-stage lifecycle

`src/lib/lifecycle/stages.ts` holds this as **data**: id, name, purpose, plain-language
"why this matters", required artifacts, required approver roles, quorum, veto roles, exit criteria as
functions returning `CriterionResult[]`, permitted agents, and links to guide content.

| # | Stage | Primary artifact(s) | Approvers (quorum) | Veto |
|---|---|---|---|---|
| 1 | **Consumption Discovery** | `decision-register.yaml` | Product Owner + SME (2) | — |
| 2 | **Charter & Value Case** | `charter.yaml`, `value-case.yaml` | Product Owner + Governance Council (2) | Product Owner |
| 3 | **Source Discovery & Profiling** | `source-inventory.yaml`, `profile-report.json`, `gap-log.yaml` | Architect + Steward (2) | — |
| 4 | **Conceptual & Logical Model** | `logical-model.yaml`, `er.mermaid` | Architect + SME (2) | Architect |
| 5 | **Attribute Register & Data Contract** | `attribute-register.yaml`, `data-contract.yaml` | Steward + SME + Product Owner (3) | Steward |
| 6 | **Semantic Model & Metrics** | `semantic-model.yaml` | Semantic Steward + SME (2) | Semantic Steward |
| 7 | **Physical Architecture** | `physical-architecture.yaml`, `lineage.mermaid` | Architect + Engineer (2) | Architect |
| 8 | **Quality & Observability** | `quality-rules.yaml`, `runbook.md` | Steward + Engineer (2) | Steward |
| 9 | **Access & Governance** | `access-policy.yaml`, `regulatory-map.yaml` | Privacy Officer + Product Owner (2) | **Privacy Officer** |
| 10 | **Serving & Consumption** | `serving-spec.yaml`, `marketplace-listing.json`, `grounding-pack.json` | Semantic Steward + Product Owner (2) | Semantic Steward |
| 11 | **Certification & Publication** | `certification-scorecard.yaml`, evidence pack (docx + pdf) | Governance Council + Product Owner (2) | Governance Council |
| 12 | **Operate, Evolve & Retire** | `telemetry.json`, `feedback-log.yaml`, `change-requests.yaml`, `benefit-realisation.yaml` | Product Owner (1) | Governance Council |

### Stage detail

**1 · Consumption Discovery.** Each decision record: consumer persona (a named role), the decision
blocked today, cadence, current workaround, latency tolerance, consequence of not deciding, and the
questions they would ask. Pre-populated from the approved request. **This is the most important
screen in the application — give it the most design attention.** Stage 2 is hard-blocked until one
complete entry exists.

**2 · Charter & Value Case.** Archetype (Entity Master, Event Stream, Metric/KPI, Feature Store,
Reference Data, Insight/Recommendation), tier (source-aligned, aggregate, consumer-aligned), scope
boundary with an **explicit out-of-scope list**, target consumption patterns, and a **value case with
a measurable hypothesis**: baseline, expected change, measurement method, measurement date. The
measurement date creates a task at Stage 12. A charter with an unmeasurable hypothesis fails the
exit criteria.

**3 · Source Discovery & Profiling.** Source inventory, system-of-record designation, profile
statistics (row counts, null rates, cardinality, distinct patterns, min/max, samples), gap log.
**Support CSV upload for offline profiling** — never require a live warehouse connection.

**4 · Conceptual & Logical Model.** Entities, relationships, an **explicit grain statement**, keys,
binding to the pack's conformed backbone, and identity resolution with a **required
deterministic/probabilistic declaration plus written justification**. Render as Mermaid ER.

**5 · Attribute Register & Data Contract.** The workhorse. Per attribute: name, business definition,
source lineage, datatype, nullability, allowed values, sensitivity classification, PII and
regulatory flags, derivation logic, steward, consumption-pattern exposure. Generates
`data-contract.yaml` covering schema, SLAs, quality thresholds, semantic versioning rules,
deprecation policy. **Must support bulk import/export via Excel** — SMEs will not review 200
attributes in a web form. The workbook uses colour-coded input columns, dropdown validations, a
locked reference sheet, a live review-summary sheet driven by COUNTIFS, and a parking-lot tab.

**6 · Semantic Model & Metrics.** Entities, dimensions, joins and certified metrics in a
MetricFlow-style YAML. Enforce **workspace-unique metric names**. **Every metric must trace to at
least one Stage 1 question or it fails the exit criteria.** Surface the commitment in the UI: *one
metric, one definition, one answer, every channel.*

**7 · Physical Architecture.** Medallion (Bronze/Silver/Gold) mapping per attribute, ingestion
pattern, orchestration and scheduling, refresh strategy, generated lineage graph. **Platform-neutral
core** with pack-supplied platform profiles (Snowflake, Databricks, BigQuery, Fabric, on-prem,
lakehouse-on-object-store) that change vocabulary and templates only — never logic.

**8 · Quality & Observability.** Rules bound to attributes across freshness, completeness, validity,
uniqueness, consistency, timeliness. Thresholds must reconcile with the Stage 5 contract SLAs — a
rule contradicting the contract fails the exit criteria. Alert routing and remediation runbook.

**9 · Access & Governance.** ABAC and purpose-based access policies, masking and row-level rules,
regulatory constraint mapping from the pack's control library, retention and residency. **The gate
is blocked until every attribute carries a sensitivity classification.** Privacy & Security Officer
holds a hard veto.

**10 · Serving & Consumption.** BI semantic binding, API specification, `marketplace-listing.json`
(owner, steward, domain, description, lineage summary, quality score, freshness, access tier,
cost-to-serve, sample queries, sample data, supported patterns), and `grounding-pack.json` for
conversational and agentic consumers (sample questions, glossary terms, metric definitions, allowed
joins, disambiguation hints, refusal guidance). **The validator rejects any grounding artifact
referencing a physical Bronze or Silver table.**

**11 · Certification & Publication.** DATSIS+V scorecard — Discoverable, Addressable, Trustworthy,
Self-describing, Interoperable, Secure, Valuable — where **each dimension is scored against cited
evidence, not free text**. A citation references a specific artifact version or approval. Generates a
signed evidence pack (Word + PDF) containing every artifact version, every approval, every audit
event, and the human/agent provenance summary. Publication to the marketplace happens here.

**12 · Operate, Evolve & Retire.** Usage telemetry, consumer feedback log, change requests, semantic
version bumps triggering cascade re-approval, **benefit realisation against the Stage 2 hypothesis**,
deprecation and retirement workflow with consumer notification and a sunset period.

### Per-stage interaction model (identical for all twelve)

```
draft → agent assist (optional) → human disposition of agent output → submit for review
   → reviewer comments anchored to specific fields → changes requested → resubmit
   → gate opens → decisions recorded → APPROVED → artifact locked → next stage unlocked
```

Every stage screen carries the same furniture: a **"Why this stage matters"** panel (open by default
for first-time users), a live exit-criteria checklist, the agent panel, the review thread, version
diff, parking lot, and the gate panel. Consistency here is what makes the application teachable.

## 9. The agentic layer

This is the product's name; build it with the seriousness that implies. **Agents act. Humans
decide.**

### Autonomy levels

| Level | Name | Behaviour |
|---|---|---|
| **L0** | Off | Agent never runs |
| **L1** | Suggest *(default)* | Runs only when invoked; proposes field by field; human dispositions each field |
| **L2** | Draft | Runs on a stage-entry trigger; produces a whole-artifact draft; human reviews as a unit |
| **L3** | Monitor | Runs on schedule against published products; raises findings, tasks and change requests; **never edits an artifact** |

There is deliberately **no level that clears a gate or commits a version**. Say so in the Admin UI,
in the Academy, and in a test. When a client asks "can we turn on full automation?", the honest
answer — and the product's differentiator — is no.

### Agent registry

Held as data in `src/lib/agents/registry.ts`. Each agent declares: id, charter (one sentence on what
it is for), stage binding, **read scope** (which artifact types it may see), output type, autonomy
ceiling, escalation rule, and the prompt template.

| Agent | Stage | Charter |
|---|---|---|
| **Discovery** | 1 | Expand an intake request into candidate decision records; propose questions the consumer did not think to ask |
| **Curator** | 1, portfolio | Detect near-duplicate products and reuse opportunities across the portfolio |
| **Profiling** | 3 | Turn profile output into a gap log; flag anomalous null rates, cardinality and pattern drift |
| **Modelling** | 4 | Propose entities, relationships and a grain statement from the source inventory |
| **Definition** | 5 | Draft attribute business definitions; propose classification and PII flags for steward review |
| **Semantic** | 6 | Propose metrics traced to Stage 1 questions; detect near-duplicate metric names workspace-wide |
| **Quality** | 8 | Derive rules and thresholds from observed distributions and contract SLAs |
| **Compliance** | 9 | Map attributes to the control library; flag unclassified and high-risk combinations |
| **Grounding** | 10 | Propose sample questions, glossary terms, allowed joins and disambiguation hints; run the Bronze/Silver rejection check |
| **Evidence** | 11 | Assemble citations for each DATSIS+V dimension; flag uncited or weak evidence |
| **Steward** | 12 (L3) | Monitor freshness, quality, schema drift and usage decay; raise change requests |
| **Critic** | all | Adversarially review the current stage against its exit criteria and the Stage 1 register; produce review comments a human can accept into the thread |

The **Critic** is the highest-value agent in the product and the clearest expression of the thesis:
it makes the AI a reviewer rather than a rubber stamp. Give it a prominent, consistent affordance on
every stage.

### Guardrails (enforce, do not merely document)

1. Output persists as a proposal, never directly as artifact content.
2. Acceptance requires an explicit human action: **Accept**, **Edit & Accept**, or **Reject** with
   optional reason.
3. Every field carries `provenance`: `HUMAN` | `AGENT_PROPOSED` | `AGENT_ACCEPTED` | `AGENT_EDITED`,
   plus accepting user and timestamp.
4. **An artifact cannot be submitted for review while any field remains `AGENT_PROPOSED`** — a named
   exit criterion, visible in the checklist.
5. Agents read only within their declared scope. No agent reads raw source data or sample rows
   unless explicitly granted per-workspace.
6. Agents cannot invoke one another without an orchestration record naming the initiating human.
7. Every invocation writes an `AgentAction`: agent, trigger, scope, input hash, model, tokens,
   estimated cost, output, human disposition.
8. Every stage must be completable with all agents disabled. Test this.

### Visual treatment and telemetry

Agent-proposed content is visually distinct (tinted, provenance chip, "Not yet reviewed"). Accepted
content keeps a subtle permanent marker. The Agents tab reports **proposal acceptance rate, human
edit rate, rejection reasons, cost per stage and estimated time saved** — the metrics that tell you
whether the agents are actually helping, and the ones a client steering committee will ask for.

Configuration: disabled by default, user-supplied API key entered in Admin and stored locally,
provider behind an adapter so model and vendor are swappable, per-workspace budget cap with hard
stop.

## 10. Consumption Patterns

Eight patterns held as data in `src/lib/patterns/registry.ts`. Each carries: name, plain-language
description, consumer persona, latency and freshness profile, required artifacts, interface contract,
guardrails, anti-patterns, readiness checklist.

| Pattern | Consumer | Requires |
|---|---|---|
| **Certified dashboard (BI)** | Executive, manager | Semantic model, BI binding, row-level security |
| **Self-serve exploration** | Analyst | Semantic model, certified vs. sandbox separation, query cost guardrails |
| **Conversational (NL → answer)** | Any business user | Grounding pack, certified metrics, disambiguation hints, refusal guidance |
| **Agentic / tool-calling** | Autonomous agent | Grounding pack, function-calling specs, allowed joins, source citation |
| **API / embedded app** | Product engineer | Endpoint spec, contract versioning, rate and cost limits |
| **Bulk extract / file** | Downstream system, regulator | Contract, schedule, delivery and retention policy |
| **ML feature consumption** | Data scientist | Feature definitions, point-in-time correctness, training/serving parity |
| **Operational activation** | CRM, contact centre, field ops | Contract, freshness SLA, write-back governance, consent enforcement |

Two views. A **learn** view explaining each pattern. A **readiness** view showing, for a selected
product, the eight patterns against their requirements — green where the required artifact exists and
is approved, amber where drafted, red where absent. This turns "is this product actually consumable?"
into an answerable question and is the clearest single demonstration of consumption-first thinking in
the application.

Guardrails enforced, not described: no free-form text-to-SQL against raw tables; conversational and
agentic patterns unavailable until Stage 10 is approved; grounding validator rejects Bronze/Silver
references.

## 11. Portfolio, value and maturity

The leadership door, and the section that separates this from a workflow tool.

**Pipeline and roadmap.** All requests and products by stage, owner, domain and target date.
Cycle-time and rework metrics per gate. Ageing and SLA breach.

**Prioritisation.** Configurable scoring, defaulting to **WSJF adapted with a reuse multiplier**:
value × urgency × risk-reduction, divided by effort, multiplied by how much of the conformed backbone
and existing attribute base the product reuses. RICE available as an alternative. Scores are advisory
and always overridable **with a recorded reason** — a scoring model no human can override is a
governance failure, not a feature.

**Dependency and reuse graph.** Which products share entities, attributes and metrics. Where a
change to one cascades. Rendered as Mermaid, computed from committed artifacts.

**Cost.** Build effort captured per stage, cost-to-serve captured at Stage 10, agent spend from
`AgentAction`. Roll up to cost per product and cost per domain. Showback view.

**Adoption.** Consumers per product, queries or sessions, pattern coverage, feedback volume and
sentiment, time since last use. **Flag products with zero consumption for 90 days** — the honest
metric most catalogues refuse to show.

**Value realisation.** Stage 2 hypothesis versus Stage 12 measured outcome, per product and rolled up
to portfolio. Three states: realised, not realised, not yet measurable. Do not let "not yet
measurable" become permanent — it ages and reports.

**Capability maturity assessment.** A five-level model across six dimensions — consumption
orientation, lifecycle discipline, semantic consistency, governance and trust, platform and
automation, operating model and adoption. In-app questionnaire producing a heatmap, a peer-band
comparison placeholder, and three recommended next moves per dimension. Exportable to Word. This is
the artifact a client engagement opens with.

**Programme KPI set** (define once, surface consistently): decision latency (question → answer),
request-to-triage time, gate cycle time, rework loops per stage, first-time certification pass rate,
reuse ratio, adoption per product, SLA adherence, cost per product, agent proposal acceptance rate,
value realisation rate.

## 12. Packs and cross-industry coverage

A pack is YAML: industry, domains, conformed backbone, canonical entities, control and regulatory
library, starter metric library, sample decision records, platform profile, glossary seed, blueprint
products, and seed marketplace listings. Validate with Zod on load; `pnpm pack:validate` in CI.

Ship `_generic` plus **utility/energy, banking, insurance, retail/CPG, healthcare, manufacturing,
telecom, public sector**. Each pack is **illustrative and editable, not authoritative** — state this
in the UI, and make pack content editable in-app with a change log.

Every pack must supply at least: six to eight domains, a conformed backbone of four or more linked
entities, ten canonical entities, eight regulatory or control constraints, ten starter metrics, three
sample decision records, and three seed marketplace products spanning different archetypes.

The **utility/energy** pack is the reference implementation and must be the richest: domains of
Customer & Account, Metering & AMI, Billing & Revenue, Credit & Collections, Outage & Reliability,
Network & Grid Assets, DER & Programs, Field & Work Management; conformed backbone Customer →
Account → Premise → Service Point → Meter; constraints covering consent, protected-status customers,
retention and regulatory reporting.

**Blueprints.** Each pack ships reusable starter products per archetype that seed Stages 1–6 with
editable content. "Start from blueprint" cuts a demo from an hour to ten minutes and, in real
delivery, is where reuse actually comes from.

## 13. Standards interoperability

Credibility across industries depends on not being a silo. Implement behind adapters in
`src/lib/standards/`, each with an explicit version pin and a round-trip test:

- **Open Data Contract Standard (ODCS)** — import/export of `data-contract.yaml`
- **Open Data Product Specification (ODPS)** — product descriptor export
- **DCAT / DCAT-AP** — catalogue interchange for public-sector and federated catalogues
- **OpenLineage** — lineage event emission
- **MetricFlow / dbt semantic manifest** — semantic model round-trip
- **schema.org `Dataset`** — marketplace listing markup for discoverability
- **OpenMetadata / DataHub** — listing export shape (export only, no live sync)

**Honest note for the build:** these specifications evolve and my knowledge of their exact current
shape may be stale. Before implementing each adapter, check the current published spec, pin the
version in the adapter, and tell me if what you find differs materially from what is described here.
Do not silently implement a remembered shape.

## 14. Academy — the teaching layer

Content lives in `src/lib/guides/registry.ts` as structured data so it renders inline in the
Lifecycle Studio *and* browses standalone.

**Per stage:** why this stage exists (three sentences, plain language); "in plain terms" (an analogy
a non-technical stakeholder will understand); **what breaks if you skip it** (the concrete downstream
failure — this is the persuasive content); who is involved and what each role contributes; what
"good" looks like; the three mistakes teams actually make here; the stage filled in from the seeded
worked example; glossary terms introduced; realistic effort range.

**Plus:** guided tours that drive the real UI with a persistent overlay, not a slideshow — "I need
data and don't know where to start" (5 min), "Triaging requests as a product owner" (7 min), "All
twelve stages" (20 min), "How the agents work and what they can't do" (6 min), "Reading the portfolio
as a CDO" (5 min). Role guides, one page per persona. A glossary, pack-seeded plus workspace-added. A
generated RACI matrix. A single-page printable **"How data products work here"** primer, exportable
to PDF for client handout.

Tone: define every technical term at first use; lead with plain language and let precision follow;
never assume the reader knows what a semantic layer is.

## 15. Exports

All behind adapters in `src/lib/exports/`:

- **Word** — charter, evidence pack, maturity assessment, stage summary
- **Excel** — attribute register (colour-coded inputs, dropdown validations, COUNTIFS review-summary
  sheet, parking-lot tab), portfolio extract
- **YAML** — contract, semantic model, every stage artifact
- **JSON** — marketplace listing, grounding pack, standards payloads
- **Mermaid + SVG** — ER, lineage, dependency graph, lifecycle flow
- **PDF** — evidence pack, Academy primer, maturity heatmap

Every committed artifact is also mirrored to `workspace/` as plain YAML/Markdown, so the whole
programme is git-diffable outside the application.

## 16. Security and data handling

Client data-handling objections are the fastest way to lose an enterprise deployment. Address them
in the build, not in a FAQ.

- Local-first. Nothing leaves the machine except explicit agent calls to the configured provider.
- Agent calls redact values flagged as PII or restricted before transmission; show the redacted
  payload preview before the first call of a session.
- Per-workspace toggle: agents may see sample data (default **off**).
- Secrets in environment or local secure storage, never in the database or committed artifacts.
- Full audit export for external assurance: every gate, decision, artifact version and agent action
  in a single signed bundle.
- Session role is re-derived server-side on every mutation; no role claim is trusted from the client.

---

## 17. Phase plan

Build in this order. **Stop at the end of each phase**, summarise what works and what is unverified,
and wait for confirmation before starting the next.

### Phase 1 — Foundation and the gate engine
Scaffold per `CLAUDE.md`. Prisma schema for: `User`, `Role`, `RoleAssignment`, `Workspace`, `Domain`,
`ProductRequest`, `RequestMessage`, `DataProduct`, `Stage`, `StageRun`, `Artifact`, `ArtifactVersion`,
`FieldProvenance`, `AgentAction`, `AgentProposal`, `Gate`, `Approval`, `Comment`, `Task`,
`AuditEvent`, `ChangeRequest`, `Pack`, `Blueprint`, `ConsumptionPatternBinding`, `AccessRequest`,
`Feedback`, `ValueMeasurement`, `MaturityAssessment`. Content-hashed immutable versions; append-only
audit; `archivedAt` never delete. The 12-stage registry as data. The transition engine:
`requestTransition()` and `recordDecision()` as the only gate paths, roles enforced server-side.
Cascade invalidation to `STALE` with re-approval tasks. `artifacts/commit.ts` — hash, version, mirror,
audit, one transaction. Auth.js + seed one user per role.
**Tests:** exit criteria, role, quorum, veto, cascade, audit immutability, and **no path other than
`recordDecision()` produces `APPROVED`**.
**Exit condition:** log in, create a product, fail a gate, fix the artifact, pass the gate, read the
full audit trail — with only Stage 1 artifacts implemented.

### Phase 2 — Intake, triage and the consumer door
`ProductRequest` state machine, five-screen intake wizard, duplicate detection surfaced before
submit, triage screen with all four actions, in-thread clarification loop, requester status
visibility, triage SLA and ageing. Marketplace browse and detail reading from seeded pack products.
Access request workflow.
**Tests:** a request cannot become a product without triage approval; a declined request cannot be
silently revived; the requester can always see status.
**Exit condition:** a consumer searches, fails to find, requests, is asked for detail, responds, and
sees it approved into a live data product.

### Phase 3 — Stages 1–6 and the agent framework
Authoring UI, Zod schemas, YAML serialisation, review threads anchored to fields, version diff and
parking lot for Stages 1–6. Agent runtime: registry, scope enforcement, proposal model, provenance,
Accept / Edit & Accept / Reject, the submission blocker, `AgentAction` logging. Wire Discovery,
Profiling, Modelling, Definition, Semantic and Critic. Excel round-trip for the attribute register.
**Exit condition:** a product moves Stage 1 → 6 with real artifacts, comments and approvals, and at
least one agent-drafted field carried through accept-and-commit with provenance visible in the audit
trail — and the same journey completes with agents disabled.

### Phase 4 — Stages 7–12, certification and publication
Stages 7–12 per §8, including the grounding-pack validator, the evidence-cited DATSIS+V scorecard,
evidence pack export (Word + PDF), publication to the marketplace, benefit realisation capture, and
change requests triggering cascade re-approval. Quality, Compliance, Grounding and Evidence agents.
**Exit condition:** a product certifies, publishes, and a change request bumps a version and
correctly invalidates downstream approvals.

### Phase 5 — Full agentic layer
Agents tab: registry UI, charters, autonomy configuration L0–L3, supervision queue, action log,
acceptance-rate and cost telemetry, budget cap. Curator across the portfolio. Steward at L3 with
scheduled monitoring raising findings and change requests. PII redaction before transmission.
**Exit condition:** an L3 Steward run on a published product raises a change request that a human
dispositions, end to end, with the full action log auditable — and the "no autonomy level clears a
gate" test passes.

### Phase 6 — Portfolio, patterns, packs, Academy
Portfolio: pipeline, prioritisation scoring with override reasons, dependency graph, cost, adoption
including the 90-day zero-consumption flag, value realisation, maturity assessment with Word export.
Pattern registry and readiness matrix. Guide registry, inline panels, guided tours, role guides,
glossary, generated RACI, printable primer. All nine packs with blueprints and seed listings.
**Exit condition:** the app is demoable cold to a client who has never seen it, with a populated
cross-industry marketplace, a complete worked example, and a maturity assessment they could take
away.

### Phase 7 — Standards, exports and hardening
Standards adapters with version pins and round-trip tests. Remaining export adapters. Playwright e2e
covering request-to-certification happy path plus rejection, veto, info-requested, cascade and
retirement paths. Complete seeded worked example. README with five-minute quickstart. ADRs. Audit
export bundle. Performance sanity at ~500 attributes and ~50 products. Accessibility pass.

---

## 18. Working agreement

- **Plan first** for any multi-file change: list the files you will touch, then execute.
- **Vertical slices over horizontal scaffolding** — one stage fully working beats twelve half-wired.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` before declaring anything done, and
  **tell me explicitly what you could not verify**.
- **Ask** when governance semantics are ambiguous. **Do not ask** about styling.
- Registries are data. Adding a stage, agent, pattern, pack or guide must never require editing the
  transition engine.
- No speculative files, no placeholder routes, no abstraction without a second concrete use case.

## 19. Anti-goals and honest limitations

Say no to these, and tell me if I ask for them by accident:

- A pipeline builder, query engine, or anything that executes transformations. ADPM designs, governs
  and manages data products; it does not run them.
- A live warehouse dependency in any core flow.
- An agent that can approve, commit, publish, or complete a stage. No exceptions, no override.
- A single blended navigation across consumer, practitioner and leadership.
- Gates modelled as a status enum on `DataProduct`.
- Industry logic in application code rather than packs.
- A prioritisation score that cannot be overridden by a named human with a recorded reason.
- Claiming standards conformance without a round-trip test against the pinned specification.

State these limitations plainly in the README and the Academy. A tool that is honest about its
boundary is more credible in an enterprise procurement conversation than one that claims everything.

---

**Start with Phase 1.** Before writing any code, give me (a) your proposed Prisma schema, (b) the
shape of `stages.ts`, (c) the `ProductRequest` state machine, and (d) the shape of the agent registry
entry and `AgentAction`. Wait for my sign-off on those four things.
