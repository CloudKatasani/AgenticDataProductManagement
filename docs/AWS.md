# Hosting Agentic Data Product Management on AWS

A step-by-step guide to run ADPM on AWS for a shared team demo, a client sandbox, or a workshop
environment.

> **Read §1 before you provision anything.** ADPM was built local-first. Several things that are
> fine on a laptop are wrong on a server, and one of them — authentication — is a hard blocker for
> anything reachable beyond a trusted group. §1 lists exactly what must change, with file
> references. **None of those changes are in the repository yet.** This document specifies them; it
> does not contain them.

For local use, read [RUNNING.md](../RUNNING.md). For the operational reference behind both, see
[DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. What must change before this is hosted

### 1.1 Blocking for anything other people can reach

| # | Problem | Where | What has to happen |
|---|---------|-------|--------------------|
| **B1** | **There is no user management at all.** No signup, no invitation, no password change, no password reset, no deactivation. The only accounts that exist are the ones `pnpm db:seed` creates, and every one of them has the password `adpm` — which is published in the README and on the sign-in screen. | `prisma/seed.ts:83`, `src/auth.ts:24` (the only place `passwordHash` is read; nothing writes it outside the seed) | Either put the whole thing behind network-level access control so only trusted people can reach the sign-in page (§7, and what this guide assumes), **or** build user management first: create/invite, set password, rotate, deactivate — plus removing the seeded accounts from any non-demo database. Do not put the seeded accounts on the public internet. |
| **B2** | `AUTH_SECRET` ships as the literal string `adpm-local-development-secret-change-me`. It signs the session JWT. Anyone who knows it can forge a session as any user, including `admin@adpm.local`. | `.env.example` | Generate a real one (`openssl rand -base64 32`) and inject it from AWS Secrets Manager. Never bake it into the image. |
| **B3** | **The workspace mirror writes to the container filesystem and throws if it cannot.** `commitArtifact()` writes `workspace/<product>/<file>` under `process.cwd()` *after* the database transaction has committed. On a read-only or full filesystem the version **is** saved but the user is told the commit failed — so they write it again. | `src/lib/artifacts/commit.ts:167-177` | Make the mirror configurable and non-fatal: an env var for the directory (with an "off" value), and a failed mirror write returned as a warning on the successful result rather than thrown. Nothing in the application ever reads the mirror back — it is a git-diff convenience, not a system of record — so disabling it loses no data. See §1.4 for the shape of the change. |

### 1.2 Blocking for a containerised or multi-instance deployment

| # | Problem | Where | What has to happen |
|---|---------|-------|--------------------|
| **B4** | Agent API keys saved through Admin are written to `.adpm-secrets.json` in `process.cwd()`. In a container that file is ephemeral and per-task: it vanishes on redeploy, and with two tasks running, one has the key and the other does not. | `src/lib/secrets.ts:18,43` | Use the `ANTHROPIC_API_KEY` environment variable instead — the code already prefers it over the file. Treat the Admin key field as a laptop-only affordance and say so, or hide it when the env var is set. |
| **B5** | There is no `Dockerfile`, and `next.config.ts` does not set `output: 'standalone'`, so a container image has to carry the whole toolchain and `node_modules`. | repo root, `next.config.ts` | Add both. §4 gives working content for each. |
| **B6** | There is no health-check endpoint. An ALB target group needs one. | `src/app/api/` | Add `GET /api/health` returning 200 with a database round-trip. Until then, point the target group at `/signin`, which returns 200 unauthenticated — but that only proves the process is up, not that the database is reachable. |

### 1.3 Needs care, not necessarily a code change

| # | Issue | Detail |
|---|-------|--------|
| **C1** | **The Postgres path has never been executed.** `docker-compose.yml`, `scripts/prepare-postgres.ts` and `pnpm db:seed:pg` exist and the schema derivation is exercised, but no Docker daemon was available where this was built, so seeding against a live Postgres has not been run once. SQLite is the tested store. | Run `pnpm db:seed:pg` against a local `docker compose up -d` **before** you provision RDS. If it fails, fix it there, not at 2am against a cloud database. |
| **C2** | **The seed is destructive and demo-only.** It opens with `deleteMany()` across every table and then creates 9 workspaces of fictional products. There is no "bootstrap an empty instance with one real workspace" path. | For a demo box this is exactly what you want — run it once. For anything else, you need a bootstrap script that creates one workspace, real roles and real users, and does not delete anything. That does not exist yet. |
| **C3** | SQLite will not work on AWS in any of the architectures below. Ephemeral container storage loses it on redeploy; EBS works for exactly one instance and makes that instance a pet. | Use RDS Postgres. This is what C1 is about. |
| **C4** | Sessions are JWT (`src/auth.ts:13`), so they are stateless — no sticky sessions, no shared session store needed. This one is good news. | Nothing to do. Noted because it is the usual multi-instance trap and ADPM avoids it. |
| **C5** | The agent budget cap is per workspace and enforced in-process. Two tasks running concurrently each read-modify-write `agentSpendUsd`, so the cap can be overshot under concurrency. | Immaterial at demo scale. Worth knowing before you attach a real API key to a multi-task deployment. |

### 1.4 The shape of the B3 fix

For reference, the change is small. `mirrorToWorkspace` currently is:

```ts
async function mirrorToWorkspace(relativePath: string, body: string): Promise<void> {
  const absolute = join(process.cwd(), relativePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, body, 'utf8')
}
```

It needs to (a) honour an `ADPM_WORKSPACE_DIR` env var, including an `off` value, (b) return a
warning instead of throwing, and (c) have `CommitResult` carry that warning so
`commitArtifactAction` can append it to the success message. The commit itself must still be
reported as a success, because it is one.

---

## 2. Choose an architecture

| | **A — Single EC2 + RDS** | **B — ECS Fargate + ALB + RDS** |
|---|---|---|
| Best for | A shared demo box, a client sandbox, a workshop | A longer-lived internal service |
| Instances | One | One or more |
| Workspace mirror (B3) | **Works** — persistent EBS filesystem | Needs EFS, or turn it off |
| Effort | Low: one instance, Docker, a security group | Medium: ECR, task definition, ALB, target group, IAM |
| Rough cost | ~$40–60/month | ~$90–130/month |
| Requires B5, B6 | Dockerfile only | Dockerfile **and** health check |

**Start with A.** ADPM's own design points at it: a single writable filesystem and a single
process. Option B is the scale-up, and it is worth the extra pieces only once more than a handful
of people depend on the thing being up.

Costs are order-of-magnitude for `us-east-1` at on-demand list price, dominated by the instance and
RDS. Check the [AWS Pricing Calculator](https://calculator.aws) for your region before quoting a
number to anyone.

**What will not work:** Amplify Hosting, S3 + CloudFront, and Lambda-only setups. ADPM needs a
long-running Node process with a live database connection and Server Actions. There is no static
export to deploy.

---

## 3. Prerequisites

| Tool | Check |
|------|-------|
| AWS account with permission to create VPC, EC2, RDS and Secrets Manager resources | `aws sts get-caller-identity` |
| AWS CLI v2 | `aws --version` |
| Docker (for option B, or to build the image locally) | `docker --version` |
| The repo cloned and running locally per [RUNNING.md](../RUNNING.md) | `pnpm dev` works |

**Do this first, on your laptop:** prove the Postgres path (C1). It is the single most likely thing
to bite you, and it costs nothing to check.

```bash
docker compose up -d
# point DATABASE_URL at the local Postgres, per DEPLOYMENT.md §4
pnpm db:seed:pg
pnpm dev
```

If that does not produce a working app, stop. Fix it locally before anything reaches AWS.

---

## 4. Prepare the build

Both architectures need a container image, which means the B5 changes.

**Add `output: 'standalone'` to `next.config.ts`:**

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',        // <- add this
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs', 'docx'],
  typedRoutes: false,
  eslint: { dirs: ['src', 'tests', 'scripts', 'prisma'] },
}
```

`pnpm dev` and `pnpm start` are unaffected; it only adds a `.next/standalone` output directory.

**Add a `Dockerfile` at the repository root:**

```dockerfile
# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY scripts/ensure-env.mjs ./scripts/ensure-env.mjs
COPY .env.example ./.env.example
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Only needs a syntactically valid URL to generate the client; it never connects.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN pnpm db:pg:prepare \
 && pnpm exec prisma generate --schema prisma/schema.postgres.prisma \
 && pnpm exec next build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
ENV ADPM_WORKSPACE_DIR=off
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma/schema.postgres.prisma ./prisma/schema.prisma
COPY --from=build /app/node_modules/.prisma/client ./node_modules/.prisma/client
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

`ADPM_WORKSPACE_DIR=off` assumes the B3 change is in. Without it, that variable does nothing and
every artifact commit will report a false failure in a container. Do B3 first.

**Add a `.dockerignore`,** or the build context carries your local database and secrets:

```
node_modules
.next
.git
.env
.adpm-secrets.json
*.db
prisma/dev.db*
prisma/test.db*
prisma/schema.postgres.prisma
workspace/*
playwright-report
test-results
```

Build and run it locally against the compose Postgres before pushing it anywhere:

```bash
docker build -t adpm:local .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://adpm:adpm-local-development@host.docker.internal:5432/adpm?schema=public" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_TRUST_HOST=true \
  adpm:local
```

---

## 5. Provision — Option A (single EC2 + RDS)

### 5.1 Secrets first

```bash
aws secretsmanager create-secret --name adpm/auth-secret \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager create-secret --name adpm/db-password \
  --secret-string "$(openssl rand -base64 24 | tr -d '/+=')"
```

Nothing sensitive goes in the image, in the repo, or in user data.

### 5.2 RDS Postgres

Create a **db.t4g.micro** PostgreSQL 16 instance, 20 GB gp3, **not publicly accessible**, in a
private subnet, with a security group that accepts 5432 **only** from the application instance's
security group. Enable automated backups with 7-day retention.

### 5.3 The application instance

A **t3.small** (2 GB RAM — `next build` will OOM on a t3.micro, though this deployment only *runs*
the image) in a public subnet, or a private subnet behind a load balancer.

Security group: **do not open 3000 or 80 to `0.0.0.0/0`.** See §7. For a first run, allow inbound
443 from your office CIDR only, and use SSM Session Manager rather than an SSH key.

Install Docker and run the image, pulling configuration from Secrets Manager at start:

```bash
sudo dnf install -y docker && sudo systemctl enable --now docker

DB_PASS=$(aws secretsmanager get-secret-value --secret-id adpm/db-password --query SecretString --output text)
AUTH=$(aws secretsmanager get-secret-value --secret-id adpm/auth-secret --query SecretString --output text)

sudo docker run -d --name adpm --restart unless-stopped -p 127.0.0.1:3000:3000 \
  -e DATABASE_URL="postgresql://adpm:${DB_PASS}@<rds-endpoint>:5432/adpm?schema=public" \
  -e AUTH_SECRET="${AUTH}" \
  -e AUTH_TRUST_HOST=true \
  -e ADPM_WORKSPACE_DIR=/var/lib/adpm/workspace \
  -v /var/lib/adpm/workspace:/var/lib/adpm/workspace \
  <your-registry>/adpm:latest
```

Binding to `127.0.0.1:3000` keeps the app off the network until a TLS proxy fronts it (§7). The
volume mount is what makes the workspace mirror survive a redeploy — the reason option A is the
easier fit.

### 5.4 Initialise the database

The seed is **destructive** (C2). Run it exactly once, from a shell, never from the web container:

```bash
sudo docker run --rm -e DATABASE_URL="postgresql://adpm:${DB_PASS}@<rds-endpoint>:5432/adpm?schema=public" \
  --entrypoint sh <your-registry>/adpm:latest -c "npx prisma db push --skip-generate"
```

Then seed the demo data — **only if this is a demo box.** The runtime image above deliberately does
not carry `tsx` or the seed script, so run the seed from a checkout on the instance
(`pnpm db:seed:pg` with `DATABASE_URL` pointed at RDS), or build a separate admin image that
includes dev dependencies. Keeping the seed out of the web container is on purpose: nothing that
can delete every table should be one HTTP handler away from the internet.

---

## 6. Provision — Option B (ECS Fargate)

Same RDS and Secrets Manager setup. Differences:

1. Push the image to **ECR**.
2. Task definition: 0.5 vCPU / 1 GB, port 3000, `DATABASE_URL` and `AUTH_SECRET` injected via
   `secrets` (Secrets Manager ARNs), not `environment`.
3. **ALB** with an HTTPS listener and an ACM certificate; target group health check on
   `/api/health` once B6 exists, `/signin` until then.
4. Set `ADPM_WORKSPACE_DIR=off` unless you mount EFS. With more than one task and no shared
   filesystem, each task writes a partial mirror and none of them is complete.
5. Run the database push and seed as a **one-off ECS task** with the admin image, not as part of
   the service.

Sessions are JWT-based, so no sticky sessions are required (C4).

---

## 7. Access control and TLS

This is the section that compensates for B1. Until user management exists, **the network is your
authentication boundary, and the application's own login is a second factor at best.**

Pick one:

- **Best:** put the ALB or instance behind a VPN or AWS Client VPN, and do not expose it publicly
  at all.
- **Good:** ALB with an HTTPS listener, a security group restricted to your office/VPN CIDRs, and
  ACM for the certificate. Combine with Cognito or OIDC authentication *on the ALB listener* so
  ADPM's own sign-in is never the only gate.
- **Minimum for a short-lived client demo:** Caddy or nginx on the instance terminating TLS with a
  real certificate, security group restricted to the client's egress IPs, and the demo accounts'
  passwords changed in the database afterwards.

Whichever you choose: **serve it over HTTPS.** Auth.js sets a session cookie; over plain HTTP on a
shared network that cookie is readable, and it is the whole session.

Also, before anyone else touches it:

- Replace `AUTH_SECRET` (B2).
- Change the seeded passwords directly in the database, or accept that anyone who has read the
  repository can sign in as `admin@adpm.local`.
- Decide whether the demo workspaces should exist at all on that instance.

---

## 8. Agents on AWS

Agents are disabled by default and every stage is completable with them off, so the simplest
hosted deployment turns them off and is complete.

If you want them:

- Put the key in Secrets Manager and inject it as `ANTHROPIC_API_KEY`. Do **not** use the Admin
  key field on a hosted instance (B4) — it writes to a container-local file that disappears on
  redeploy.
- Set a workspace budget cap deliberately. It is enforced in-process and can be overshot under
  concurrency (C5).
- Outbound HTTPS to the model API must be allowed — a NAT gateway if the task is in a private
  subnet. That is a real line item; a NAT gateway costs more than the app instance.

With no key configured, agents fall back to the deterministic local heuristic provider and make no
network call, which is a perfectly good demo.

---

## 9. Operations

**Scheduled monitoring.** `pnpm monitor` (see DEPLOYMENT.md §6) is a script, not a service. On AWS,
run it as an **EventBridge Scheduler rule → one-off ECS task** (option B) or a cron entry on the
instance (option A). It needs `ADPM_MONITOR_USER` set to the email of the human accountable for the
schedule, and it refuses to start without one.

**Backups.** RDS automated backups cover the database, which is the system of record. The workspace
mirror is a convenience and does not need backing up. `.adpm-secrets.json` should not exist on a
hosted instance at all (B4).

**Logs.** Ship container logs to CloudWatch (`awslogs` driver on option A, `awslogs` log
configuration on option B). ADPM writes its own audit trail to the database — every gate decision,
artifact version and agent action is already append-only and queryable, so CloudWatch is for
process health, not for governance evidence.

**Updating.** Build a new image, push, and restart the container or update the ECS service. If the
Prisma schema changed, run `prisma db push` as a one-off task **before** the new image serves
traffic.

---

## 10. Teardown

```bash
# Option A
aws ec2 terminate-instances --instance-ids <id>
# Option B
aws ecs update-service --cluster <c> --service adpm --desired-count 0
aws ecs delete-service --cluster <c> --service adpm
```

Then delete the RDS instance (take a final snapshot if the data matters), the ALB, the ECR
repository, the secrets, and the NAT gateway if you created one. **The NAT gateway and the ALB
bill whether or not anyone is using them** — they are the two things people forget.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| **Every artifact commit reports failure, but the version appears anyway** | B3. The container filesystem is read-only or `workspace/` is not writable. This is the false-failure case — the data is fine. |
| **`Can't reach database server`** | RDS security group does not accept 5432 from the app's security group, or the task is in a subnet with no route to it. |
| **Sign-in fails for everyone after a redeploy** | `AUTH_SECRET` changed between deployments, invalidating every issued JWT. Inject it from Secrets Manager so it is stable, and clear cookies once. |
| **ALB health check fails but the app works** | No `/api/health` endpoint exists yet (B6). Point the check at `/signin`. |
| **Agent runs fail with a network error** | No egress to the model API — private subnet with no NAT gateway. |
| **`prisma generate` output missing at runtime** | The runtime stage did not copy `node_modules/.prisma/client`. See the Dockerfile in §4. |
| **Build OOMs** | `next build` needs ~2 GB. Build on a t3.small or larger, or in CI, not on a t3.micro. |
| **Seed wiped the database** | It is designed to (C2). It opens with `deleteMany()` across every table. Never run it against an instance holding real work. |

---

## 12. Summary — the honest position

ADPM runs on AWS today as **a private, access-controlled demo or sandbox**, on a single EC2
instance with RDS Postgres, once B3 and B5 are done and the Postgres path (C1) has been proven
locally.

It is **not ready to be an internet-facing multi-user system**, and the reason is B1: there is no
way to create, invite, rotate or deactivate a user. Everything else on this page is ordinary
deployment work. That one is a missing feature, and no amount of AWS configuration substitutes for
it — network access control is a wall around the problem, not a solution to it.
