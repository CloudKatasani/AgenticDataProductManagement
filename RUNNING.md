# Running Agentic Data Product Management locally

A step-by-step guide to run ADPM on your own machine and open the UI at
`http://localhost:3000`. It is a local-first Next.js app backed by a zero-config
SQLite file — no database server to install, no cloud service, no API key.

> The application lives at the **root** of this repository. Every command below is
> run from inside `AgenticDataProductManagement`.

For the longer operational guide — production build, the optional Postgres path,
scheduled monitoring, backup, and where secrets live — see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). This file gets you running.

---

## 1. Prerequisites

| Tool | Version | Check | Install |
|------|---------|-------|---------|
| **Node.js** | 20.11 or newer | `node -v` | <https://nodejs.org> (LTS) |
| **pnpm** | 10 or newer | `pnpm -v` | `corepack enable && corepack prepare pnpm@10 --activate` |
| **Git** | any | `git -v` | <https://git-scm.com> |

**Database:** nothing to install. ADPM uses **SQLite by default** — a single local
file (`prisma/dev.db`) created automatically in step 4. Postgres is optional and
only needed if you want a shared instance (see `docker-compose.yml` and
`docs/DEPLOYMENT.md` §4); ignore it for local use.

**Agents:** optional and disabled by default. Every stage is completable with all
agents off — that is a tested invariant. With no API key, agents run on a
deterministic local heuristic provider that makes no network call, so the whole
supervised-autonomy loop still works offline. See §7 below.

---

## 2. Get the code

```bash
git clone https://github.com/CloudKatasani/AgenticDataProductManagement.git
cd AgenticDataProductManagement
```

The `main` branch has the full app — no branch switching needed.

## 3. Install dependencies

```bash
pnpm install
```

This also **creates `.env` for you** from `.env.example` and generates the Prisma
client. There is no separate configuration step.

`.env` is gitignored and never committed. It contains:

```ini
DATABASE_URL="file:./dev.db"
AUTH_SECRET="adpm-local-development-secret-change-me"
AUTH_TRUST_HOST=true
```

`AUTH_SECRET` is a **development placeholder**. It is fine for a laptop you are the
only user of. Replace it before anyone else can reach the instance:

- **macOS / Linux:** `openssl rand -base64 32`
- **Windows (PowerShell):** `[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))`

## 4. Set up the database

```bash
pnpm db:seed     # creates prisma/dev.db, then seeds it
```

This takes roughly 30–60 seconds, and it is not writing fixture rows. It drives all
27 demo products through the **real** transition engine — the same
`requestTransition()` and `recordDecision()` calls the UI makes. If the engine is
broken, the seed fails rather than producing plausible-looking data.

Expected output ends with a summary like:

```
Seed complete: {
  workspaces: 9,
  products: 27,
  published: 27,
  gatesApproved: 324,
  artifactVersions: 675,
  auditEvents: 2349,
  requests: 3
}

Sign in with any seeded email and the password "adpm", e.g. owner@adpm.local
```

## 5. Run the app

```bash
pnpm dev
```

Open **<http://localhost:3000>**.

Unlike most demos, the first screen is not empty: you land on a cross-industry
marketplace of 27 certified, published products across nine industry packs.

---

## 6. Signing in

All seeded users share the password **`adpm`**. Each workspace has one user per
role. Choose the role you want to act as:

| Email | Role | Door | Use it to… |
|-------|------|------|------------|
| `consumer@adpm.local` | Data Consumer | Consumer | Browse the marketplace, request a product, rate one |
| `owner@adpm.local` | Domain Product Owner | Practitioner | **Triage requests**; author the charter and value case; approve Stages 1, 2, 5, 9, 10, 11, 12 |
| `sme@adpm.local` | Domain SME | Practitioner | Business meaning and decision context; approve Stages 1, 4, 5, 6 |
| `steward@adpm.local` | Data Steward | Practitioner | Attribute definitions, classification, quality rules; approve Stages 3, 5, 8; **veto** on 5 and 8 |
| `architect@adpm.local` | Data Architect | Practitioner | Model, grain, keys, physical architecture; approve Stages 3, 4, 7; **veto** on 4 and 7 |
| `engineer@adpm.local` | Data / Platform Engineer | Practitioner | Ingestion, orchestration, serving; approve Stages 7 and 8 |
| `privacy@adpm.local` | Privacy & Security Officer | Practitioner | Classification completeness and access policy; approve Stage 9; **veto** on 9 |
| `semantic@adpm.local` | Semantic Steward | Practitioner | Certified metrics and grounding integrity; approve Stages 6 and 10; **veto** on both |
| `council@adpm.local` | Governance Council | Practitioner | Certification and publication; approve Stages 2 and 11; **veto** on 11 and 12 |
| `cdo@adpm.local` | Portfolio Lead / CDO | Leadership | Prioritisation, spend, value realisation, maturity |
| `admin@adpm.local` | Admin | Run | Packs, roles, agent configuration |

**These are demo credentials with a published password.** Roles are enforced
server-side, so signing in as the consumer genuinely cannot approve a gate — it is
not a UI mode. But do not put this instance somewhere other people can reach it
without replacing the accounts.

### A first walkthrough

The most instructive path is the one the product is actually about: a business
user's unmet need becoming a governed data product.

1. **See the consumer's side.** Sign in as **`consumer@adpm.local`** → **Marketplace**.
   Search for something that exists (`arrears`, `outage`, `claims`). Then search for
   something that does not — the app pushes you to **describe the decision** rather
   than to describe a table.

2. **Triage the waiting request.** Sign out; sign in as **`owner@adpm.local`** →
   **My Work**. `REQ-1004` is sitting there with its response target breached. Open
   it, read what the consumer actually said, choose a domain, and click
   **Approve into Stage 1**. That creates a data product with the decision register
   pre-populated from the request.

3. **Work Stage 1.** On the new product's **Stage 1 — Consumption Discovery**:
   - The **exit criteria** panel is live. Watch which ones fail and why.
   - Edit the decision register, then **Commit new version**. The version is
     content-hashed and immutable; editing again creates a new one.
   - **Submit for review**, then **Open gate**.

4. **Approve as two people, because quorum is two.** Stage 1 needs
   `DOMAIN_PRODUCT_OWNER` **and** `DOMAIN_SME`. Choose **Vote as → Domain Product
   Owner**, write a rationale, **Approve**. The gate does not close. Sign out; sign
   in as **`sme@adpm.local`**; approve the same gate. Now it closes and **Stage 2
   unlocks**.

5. **Try to skip a stage.** Try to open Stage 3 before Stage 2 is approved. You
   cannot. Consumption-first is a hard block, not a suggestion.

6. **See that silence is not consent.** Stage 2 is approved by
   `DOMAIN_PRODUCT_OWNER` and `GOVERNANCE_COUNCIL`, and the product owner also holds
   the **veto**. Author the charter and value case, submit, open the gate, and
   approve as **`council@adpm.local`** only. Quorum is 2 of 2 so it would not pass
   anyway — but note *why* the gate panel says it cannot: a veto holder who has not
   voted blocks it. Silence from a veto role is never counted as agreement.

7. **Watch an approval decay.** This one needs a product whose downstream gates are
   already approved, so use a **published** one. Open any product from the
   marketplace, go to an early stage — say **Stage 5 — Attribute Register** — and
   commit a changed version. Every approved gate whose evidence snapshot recorded
   that artifact at a different content hash flips to **STALE**, with a re-approval
   task raised and the reason stated on the gate. Approvals decay when the evidence
   beneath them changes. (Run `pnpm db:reset` afterwards if you want the pristine
   demo back.)

8. **Read the approval rules as data.** **Academy** renders a RACI matrix — who
   approves and who holds a veto, for all twelve stages — computed from the same
   stage registry the transition engine enforces, so it cannot drift from behaviour.

9. **See the leadership view.** Sign in as **`cdo@adpm.local`** → **Portfolio** for
   the pipeline, prioritisation, cost, value realisation and maturity assessment.

Two stages have an import surface, because a web form is the wrong tool for the job:
**Stage 3** profiles an uploaded CSV extract locally (no warehouse connection
anywhere in ADPM), and **Stage 5** round-trips the attribute register through Excel.

## 7. Turning on agents (optional)

1. Sign in as **`admin@adpm.local`** → **Admin** → enable agents for the workspace
   and set a budget cap.
2. **Agents** tab → set an autonomy level per agent. L1 (suggest) is the default. A
   workspace setting can only ever *lower* an agent's registry ceiling, never raise it.
3. Open any stage → **Run agent** → review each proposal → **Accept**, **Edit &
   accept**, or **Reject**.

Nothing is applied automatically. An artifact **cannot be submitted for review while
any field is still unreviewed agent output** — that is an exit criterion, not a UI
convention. Accepting a proposal makes the field yours: it carries your name, not
the agent's.

With no API key configured this runs on the `local-heuristic` provider —
deterministic, rule-based, offline, and labelled as such everywhere it appears. To
use a real model instead, set `ANTHROPIC_API_KEY` before starting the server, or
paste a key into Admin (it is written to a `0600` git-ignored file, never the
database). Values flagged as PII or restricted are redacted before transmission and
the redacted-field count is reported back after every run.

**No autonomy level clears a gate, commits a version, or publishes anything.** There
is no configuration, override or trusted mode that changes this.

---

## 8. Verifying the build (optional)

```bash
pnpm typecheck      # TypeScript, no errors
pnpm lint           # ESLint, zero warnings tolerated
pnpm test           # unit + integration, real SQLite, no mocks
pnpm build          # production build
pnpm pack:validate  # validate the nine industry packs
```

Tests use their own `prisma/test.db` and never touch your demo data.

End-to-end browser tests need Chromium once, and a built server on port 3111:

```bash
pnpm exec playwright install chromium
pnpm db:seed && pnpm build
PORT=3111 pnpm start &
pnpm test:e2e
```

If your machine already has a Chromium that does not match this Playwright version,
point at it instead of downloading another:
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Port 3000 in use** | `PORT=4000 pnpm dev`, then open `:4000` |
| **`Environment variable not found: DATABASE_URL`** | `.env` is missing — `cp .env.example .env`, or re-run `pnpm install` |
| **`The table does not exist` / Prisma P1003** | The database was never created — run `pnpm db:seed` |
| **Prisma client errors after switching stores** | `pnpm db:generate` (SQLite) or `pnpm db:pg:setup` (Postgres) |
| **Want a clean database** | `pnpm db:reset` — destructive, no confirmation, no undo |
| **Sign-in fails for every account** | `AUTH_SECRET` changed after sessions were issued — clear site cookies and sign in again |
| **Seed fails: "Stage N does not meet its exit criteria"** | The engine is correctly refusing something in the pack data, usually a duplicate metric name. Fix the pack; do not weaken the criterion. `pnpm pack:validate` catches the common cases first |
| **An agent refuses to run** | Read the message — agents disabled for the workspace, agent not chartered for that stage, autonomy too low for the trigger, budget exhausted, or your role does not permit invoking agents |
| **Node too old** | Install Node 20.11+ (`node -v` to check) |

Use **`pnpm dev`** for local viewing. Everything runs offline — no network access,
no warehouse connection and no external service is required by any core flow.
