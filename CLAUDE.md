# CLAUDE.md — Agentic Data Product Management (ADPM)

This file is binding. Read it before every task. If an instruction anywhere else conflicts with
this file, **stop and flag the conflict** — do not resolve it silently.

Package name: `adpm`. Product name in all UI copy: **Agentic Data Product Management**. Short form
**ADPM** is acceptable after first use on a screen.

---

## 1. What this application is

ADPM is a locally hosted, enterprise-grade, industry-agnostic web application for **managing the
full lifecycle of data products** — from a business user's unmet decision need through design,
certification, publication, consumption and retirement — with **AI agents doing the work and humans
making every decision**.

It has three audiences and three front doors:

- **Consumers** browse a marketplace and request data products in plain business language.
- **Practitioners** move approved requests through a governed 12-stage lifecycle.
- **Leadership** manages the portfolio: what to build next, what it costs, what value it returned,
  and how mature the organisation's data product capability is.

It is also a **teaching instrument** and a **client-ready demo asset**. It ships pre-populated with a
cross-industry marketplace so the first screen a stakeholder sees is credible, not empty.

## 2. Resolving the word "agentic"

The name commits us to something. Honour it precisely:

> **Agents act. Humans decide.**

Agents research, profile, draft, cross-check, critique, monitor and escalate. They produce
proposals, findings and alerts. They never approve a gate, never commit an artifact version, never
publish, and never satisfy an exit criterion on their own authority. There is no configuration,
autonomy level, admin override or "trusted mode" that changes this. If a request would require one,
refuse and flag it.

This is not a limitation to apologise for in the UI. It is the product's central claim:
**supervised autonomy** — maximum agent leverage, zero unaccountable decisions.

## 3. Non-negotiable invariants

Violating one is a defect regardless of what else works. Each has a corresponding test.

1. **Consumption-first.** No data product exists without a named consumer persona, a named decision
   blocked today, and the questions that consumer would ask. Stage 2 is hard-blocked until Stage 1
   has at least one complete decision record. Pipelines, platforms and tools are supporting detail,
   never the entry point.
2. **One approval path.** `recordDecision()` is the *only* code path that can move a `Gate` to
   `APPROVED`. No API route, service, seed script, agent or admin action may set that state directly.
3. **Immutability.** `ArtifactVersion` is content-hashed and append-only. Edits create new versions.
   `AuditEvent` and `AgentAction` are append-only. Nothing is hard-deleted; use `archivedAt`.
4. **Cascade honesty.** Committing a new version of an artifact that an approved downstream gate
   relied on flips those gates to `STALE` and raises re-approval tasks. Approvals decay when their
   evidence changes.
5. **Human in the loop, structurally.** Every agent output is persisted as a proposal with
   field-level provenance. **An artifact cannot be submitted for review while any field remains
   unreviewed agent output.** Enforced as a named exit criterion, not a UI convention.
6. **Agent accountability.** Every agent invocation writes an `AgentAction` recording agent id,
   trigger, declared read scope, input hash, model, token count, estimated cost, output, and the
   human disposition of that output. An agent that cannot be audited cannot run.
7. **Grounding purity.** Conversational and agentic consumption artifacts may reference only
   certified semantic-layer objects. Any grounding artifact referencing a physical Bronze or Silver
   table is rejected by the validator. No free-form text-to-SQL against raw tables, ever.
8. **Evidence over assertion.** Certification scores cite specific artifact versions and approvals.
   Free-text justification alone never clears a certification dimension.
9. **Value closes the loop.** Every product carries a value hypothesis from Stage 2 through to a
   measured outcome at Stage 12. A product may be published without realised value; it may not be
   published without a stated, measurable hypothesis.
10. **Roles enforced server-side.** Client-side role checks are a convenience, never a control.
11. **Industry logic lives in packs.** No industry name, domain, regulation or entity may be
    hard-coded in application code. If you find yourself writing `if (industry === …)`, stop.

## 4. Stack

- **Next.js 15** (App Router, Server Actions), **TypeScript strict**, **React 19**
- **Tailwind CSS** + **shadcn/ui** + **lucide-react**
- **Prisma** — SQLite by default (zero-config local run), Postgres via `docker-compose.yml`
- **Auth.js v5** credentials provider, role-based session
- **Zod** for every schema — one schema per artifact type, shared by server action and form
- **react-hook-form** + **@tanstack/react-query**
- **Mermaid** for ER, lineage, flow and dependency diagrams
- **docx**, **exceljs**, PDF rendering, **yaml** for exports
- **Vitest** (unit/integration) + **Playwright** (e2e)
- **pnpm**

Constraints: runs fully offline on a laptop via `pnpm install && pnpm db:seed && pnpm dev`. No cloud
service is required for any core flow. Agents are optional, disabled by default, and use a
user-supplied API key.

## 5. Repository layout

```
src/
  app/
    (consumer)/marketplace/…        # browse, detail, access request
    (consumer)/request/…            # intake wizard, my requests
    (workspace)/inbox/…             # my approvals, reviews, tasks, agent queue
    (workspace)/products/[id]/…     # lifecycle studio, one route per stage
    (leadership)/portfolio/…        # pipeline, prioritisation, value, cost, maturity
    (enable)/patterns/…             # consumption patterns + readiness matrix
    (enable)/agents/…               # agent registry, autonomy, action log
    (enable)/academy/…              # teaching layer
    admin/…                         # packs, roles, controls, standards, config
    api/…
  lib/
    lifecycle/stages.ts             # 12-stage registry AS DATA
    lifecycle/transitions.ts        # requestTransition / recordDecision — the only gate paths
    lifecycle/criteria.ts           # exit criteria evaluators
    artifacts/                      # schemas, commit.ts, diff.ts, serialise.ts
    agents/registry.ts              # agent charters AS DATA
    agents/runtime.ts               # invocation, scope enforcement, action logging
    patterns/registry.ts            # consumption pattern registry AS DATA
    guides/registry.ts              # teaching content AS DATA
    portfolio/                      # scoring, value tracking, maturity model
    packs/                          # loader + validator
    standards/                      # ODCS, ODPS, DCAT, OpenLineage adapters
    exports/                        # docx | xlsx | yaml | json | svg | pdf adapters
    audit/
  components/
prisma/
packs/                              # _generic + industry packs (YAML)
workspace/                          # git-friendly mirror of committed artifacts
tests/
docs/adr/
```

## 6. Coding standards

- Server Actions for mutations; route handlers only for exports, streaming agent output, webhooks.
- Every mutation: authenticate → authorise by role → validate with Zod → transact → emit
  `AuditEvent`. In that order. No exceptions.
- Registries (`stages`, `agents`, `patterns`, `guides`) are **data, not code branches**. Adding a
  stage, agent, pattern or pack must not require editing the transition engine.
- No `any`. No `@ts-expect-error` without a comment naming the upstream issue.
- No abstraction until there is a second concrete use case.
- No placeholder routes, no speculative files, nothing shipped as done with a `TODO` inside it.
- Accessibility: keyboard-navigable, labelled inputs, visible focus, WCAG AA contrast.

## 7. Vocabulary (use these exact terms in code and UI)

| Term | Meaning |
|---|---|
| **Data Product** | The unit of work moving through the lifecycle |
| **Product Request** | A consumer-submitted intake record; becomes a Data Product only on triage approval |
| **Artifact** | A named, versioned, schema-validated document produced at a stage |
| **Artifact Version** | Content-hashed, immutable snapshot |
| **Gate** | The approval checkpoint between stages: roles, quorum, veto, decisions, audit |
| **Stage Run** | One pass of a product through one stage |
| **Exit Criterion** | A machine-evaluated condition that must pass before a gate can open |
| **Agent** | A chartered, scoped, auditable AI worker that produces proposals and findings |
| **Agent Action** | The append-only record of one agent invocation and its human disposition |
| **Autonomy Level** | L0–L3; the ceiling on what an agent may do without being asked |
| **Consumption Pattern** | A named way a consumer uses the product (BI, conversational, API, …) |
| **Grounding Pack** | The artifact that makes a product safely usable by an LLM or agent |
| **Blueprint** | A reusable starter product that seeds early-stage artifacts |
| **Pack** | Declarative industry configuration |
| **Provenance** | Per-field record of human vs. agent origin and who accepted it |

## 8. Definition of done

Nothing is done until all of the following pass and you have said so explicitly:

```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Then state, in plain language: what works, what is stubbed, and **what you could not verify**. Never
claim a flow works if you have not exercised it.

## 9. When to ask vs. decide

- **Ask** when governance semantics are ambiguous — who approves what, what quorum means, whether a
  role holds veto, what invalidates an approval, what an exit criterion should measure, what an
  agent may read.
- **Decide** on styling, component structure, file naming, library choice within the stack, and copy
  tone. Pick something clean and move on. Do not ask about visual design.
