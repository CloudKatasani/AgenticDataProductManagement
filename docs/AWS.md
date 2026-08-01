# Hosting Agentic Data Product Management on AWS

A step-by-step guide to run ADPM on AWS for a shared team demo, a client sandbox, or a workshop
environment.

> **Read [hosting-prerequisites.md](hosting-prerequisites.md) first.** ADPM was built local-first.
> Six things have to change in the code before it is hosted anywhere, and one of them —
> authentication — is a hard blocker for anything reachable beyond a trusted group. That document
> lists them with file references, and supplies the `Dockerfile` and `next.config.ts` change every
> cloud needs. **None of those changes are in the repository.** The `B*` and `C*` identifiers used
> below refer to it.

For local use, read [RUNNING.md](../RUNNING.md). For the operational reference behind both, see
[DEPLOYMENT.md](DEPLOYMENT.md). Sibling guides: [Azure](AZURE.md), [GCP](GCP.md).

---

## 1. Choose an architecture

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

## 2. Prerequisites

| Tool | Check |
|------|-------|
| AWS account with permission to create VPC, EC2, RDS and Secrets Manager resources | `aws sts get-caller-identity` |
| AWS CLI v2 | `aws --version` |
| Docker | `docker --version` |
| The repo cloned and running locally per [RUNNING.md](../RUNNING.md) | `pnpm dev` works |
| The B3 and B5 changes made, and the image built and run locally | [hosting-prerequisites.md §4–5](hosting-prerequisites.md) |

Do not skip the local image run in the prerequisites. Proving the Postgres path (C1) and the
container on your laptop costs nothing; discovering they are broken against RDS costs an afternoon.

---

## 3. Provision — Option A (single EC2 + RDS)

### 3.1 Secrets first

```bash
aws secretsmanager create-secret --name adpm/auth-secret \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager create-secret --name adpm/db-password \
  --secret-string "$(openssl rand -base64 24 | tr -d '/+=')"
```

Nothing sensitive goes in the image, in the repo, or in user data.

### 3.2 RDS Postgres

Create a **db.t4g.micro** PostgreSQL 16 instance, 20 GB gp3, **not publicly accessible**, in a
private subnet, with a security group that accepts 5432 **only** from the application instance's
security group. Enable automated backups with 7-day retention.

### 3.3 The application instance

A **t3.small** (2 GB RAM — `next build` will OOM on a t3.micro, though this deployment only *runs*
the image) in a public subnet, or a private subnet behind a load balancer.

Security group: **do not open 3000 or 80 to `0.0.0.0/0`.** See §5. For a first run, allow inbound
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

Binding to `127.0.0.1:3000` keeps the app off the network until a TLS proxy fronts it (§5). The
volume mount is what makes the workspace mirror survive a redeploy — the reason option A is the
easier fit.

### 3.4 Initialise the database

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

## 4. Provision — Option B (ECS Fargate)

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

## 5. Access control and TLS

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

## 6. Agents on AWS

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

## 7. Operations

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

## 8. Teardown

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

## 9. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| **Every artifact commit reports failure, but the version appears anyway** | B3. The container filesystem is read-only or `workspace/` is not writable. This is the false-failure case — the data is fine. |
| **`Can't reach database server`** | RDS security group does not accept 5432 from the app's security group, or the task is in a subnet with no route to it. |
| **Sign-in fails for everyone after a redeploy** | `AUTH_SECRET` changed between deployments, invalidating every issued JWT. Inject it from Secrets Manager so it is stable, and clear cookies once. |
| **ALB health check fails but the app works** | No `/api/health` endpoint exists yet (B6). Point the check at `/signin`. |
| **Agent runs fail with a network error** | No egress to the model API — private subnet with no NAT gateway. |
| **`prisma generate` output missing at runtime** | The runtime stage did not copy `node_modules/.prisma/client`. See the Dockerfile in [hosting-prerequisites.md §5](hosting-prerequisites.md). |
| **Build OOMs** | `next build` needs ~2 GB. Build on a t3.small or larger, or in CI, not on a t3.micro. |
| **Seed wiped the database** | It is designed to (C2). It opens with `deleteMany()` across every table. Never run it against an instance holding real work. |

---

## 10. Summary — the honest position

ADPM runs on AWS today as **a private, access-controlled demo or sandbox**, on a single EC2
instance with RDS Postgres, once B3 and B5 are done and the Postgres path (C1) has been proven
locally.

It is **not ready to be an internet-facing multi-user system**, and the reason is B1: there is no
way to create, invite, rotate or deactivate a user. Everything else on this page is ordinary
deployment work. That one is a missing feature, and no amount of AWS configuration substitutes for
it — network access control is a wall around the problem, not a solution to it.
