# Hosting Agentic Data Product Management on Google Cloud

A step-by-step guide to run ADPM on GCP for a shared team demo, a client sandbox, or a workshop
environment.

> **Read [hosting-prerequisites.md](hosting-prerequisites.md) first.** ADPM was built local-first.
> Six things have to change in the code before it is hosted anywhere, and one of them —
> authentication — is a hard blocker for anything reachable beyond a trusted group. That document
> lists them with file references, and supplies the `Dockerfile` and `next.config.ts` change every
> cloud needs. **None of those changes are in the repository.** The `B*` and `C*` identifiers used
> below refer to it.

For local use, read [RUNNING.md](../RUNNING.md). For the operational reference behind both, see
[DEPLOYMENT.md](DEPLOYMENT.md). Sibling guides: [AWS](AWS.md), [Azure](AZURE.md).

---

## 1. What GCP does well here, and what it does badly

**Well: Identity-Aware Proxy.** IAP sits in front of the application and only lets through
identities you have granted a role to. Like Azure's Easy Auth, it is a real answer to **B1** — the
missing user management — rather than a wall around it, and it is better than an IP allowlist
because it survives people working from home.

**Badly: Cloud Run's filesystem.** Cloud Run's writable filesystem is **in-memory and counts
against the instance's memory limit**. So the workspace mirror (**B3**) is not merely ephemeral
here, it consumes RAM until the instance is recycled. `ADPM_WORKSPACE_DIR=off` is not a
nice-to-have on Cloud Run; it is the correct setting, unless you mount a GCS volume specifically to
keep the mirror.

**Also worth knowing before you pick Cloud Run:** it scales out fast, and every instance opens its
own Prisma connection pool. A default `--max-instances` against a shared-core Cloud SQL instance
will exhaust the connection limit long before it exhausts CPU (**C6**). This is the single most
common way this deployment falls over.

---

## 2. Choose an architecture

| | **A — Cloud Run + Cloud SQL** | **B — Compute Engine VM + Docker + Cloud SQL** |
|---|---|---|
| Best for | Intermittent demo use; pay near-nothing when idle | A steady internal service, or full control |
| Auth in front (B1) | **IAP**, via a load balancer | IAP via a load balancer, or a VPN |
| TLS | Automatic on `run.app`; managed cert on a custom domain | You configure it |
| Workspace mirror (B3) | **In-memory — set it `off`** | Works — persistent disk |
| Health check (B6) | Recommended | Optional |
| Connection limits (C6) | **The main risk** — cap `--max-instances` | One instance, one pool |
| Rough cost | ~$15–40/month, less if it idles | ~$40–60/month |

**Pick A if the app is used in bursts** — demos, workshops, a sandbox someone opens twice a week.
Its economics are genuinely better than the other two clouds for that pattern. **Pick B if it needs
to be up**, or if you want the workspace mirror without extra machinery.

Costs are order-of-magnitude at list price and depend heavily on idle time. Check the
[GCP pricing calculator](https://cloud.google.com/products/calculator) before quoting a number.

**What will not work:** Firebase Hosting alone, Cloud Storage static hosting, and any
Functions-only design. ADPM needs a long-running Node process with a live database connection and
Server Actions. There is no static export to deploy.

---

## 3. Prerequisites

| Tool | Check |
|------|-------|
| GCP project with billing enabled | `gcloud config get-value project` |
| `gcloud` CLI | `gcloud version` |
| Docker | `docker --version` |
| The repo cloned and running locally per [RUNNING.md](../RUNNING.md) | `pnpm dev` works |
| The B3 and B5 changes made, and the image built and run locally | [hosting-prerequisites.md §4–5](hosting-prerequisites.md) |

```bash
gcloud auth login
gcloud config set project <your-project>
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com iap.googleapis.com
```

---

## 4. Provision — Option A (Cloud Run + Cloud SQL)

### 4.1 Registry and image

```bash
gcloud artifacts repositories create adpm --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/<project>/adpm/adpm:1 .
docker push us-central1-docker.pkg.dev/<project>/adpm/adpm:1
```

`--platform linux/amd64` matters if you build on Apple Silicon: the push succeeds and the deploy
fails later, with a message that does not obviously say why.

### 4.2 Cloud SQL

```bash
gcloud sql instances create adpm-pg \
  --database-version=POSTGRES_16 --tier=db-f1-micro --region=us-central1 \
  --storage-size=20GB --no-assign-ip

gcloud sql databases create adpm --instance=adpm-pg
gcloud sql users create adpm --instance=adpm-pg --password="$(openssl rand -base64 24 | tr -d '/+=')"
```

`--no-assign-ip` keeps it off the public internet; Cloud Run reaches it over the Cloud SQL
connector. Note the shared-core `db-f1-micro` tier has a **low connection limit** — this is what
C6 is about, and §4.4 caps instances accordingly.

### 4.3 Secrets

```bash
printf '%s' "$(openssl rand -base64 32)" | \
  gcloud secrets create adpm-auth-secret --data-file=-

printf '%s' "postgresql://adpm:<password>@localhost/adpm?host=/cloudsql/<project>:us-central1:adpm-pg&connection_limit=5" | \
  gcloud secrets create adpm-database-url --data-file=-
```

That `DATABASE_URL` is the Cloud SQL unix-socket form — `host=/cloudsql/...` with `localhost` as
the hostname. It looks wrong and is correct. `connection_limit=5` is C6.

### 4.4 Deploy

```bash
gcloud run deploy adpm \
  --image us-central1-docker.pkg.dev/<project>/adpm/adpm:1 \
  --region us-central1 \
  --add-cloudsql-instances <project>:us-central1:adpm-pg \
  --set-secrets DATABASE_URL=adpm-database-url:latest,AUTH_SECRET=adpm-auth-secret:latest \
  --set-env-vars AUTH_TRUST_HOST=true,ADPM_WORKSPACE_DIR=off \
  --min-instances 1 --max-instances 3 \
  --memory 1Gi --cpu 1 \
  --no-allow-unauthenticated
```

Four flags carry weight:

- `--max-instances 3` — the C6 cap. Raise it only alongside a bigger Cloud SQL tier.
- `--min-instances 1` — avoids a cold start that includes Next.js boot plus a fresh Prisma
  connection. That pause lands exactly when someone is watching you demo. Set it to `0` only if you
  genuinely prefer the saving.
- `ADPM_WORKSPACE_DIR=off` — see §1. On Cloud Run the mirror would eat memory.
- `--no-allow-unauthenticated` — nothing is public until §6 decides how it should be reached.

### 4.5 Initialise the database

The seed is **destructive** (C2), and the runtime image deliberately does not carry it. Use the
Cloud SQL Auth Proxy from your laptop:

```bash
cloud-sql-proxy <project>:us-central1:adpm-pg &
export DATABASE_URL="postgresql://adpm:<password>@127.0.0.1:5432/adpm"
pnpm db:pg:setup     # derives the Postgres schema and pushes it
pnpm db:seed:pg      # demo data — only on a demo instance
```

Running it through the proxy rather than from the serving container is deliberate: nothing that can
delete every table should be reachable from an HTTP handler.

---

## 5. Provision — Option B (Compute Engine)

A small `e2-small` (2 GB) with Docker, and the same Cloud SQL instance reached through the Cloud
SQL Auth Proxy running alongside as a container or systemd unit.

```bash
sudo docker run -d --name adpm --restart unless-stopped -p 127.0.0.1:3000:3000 \
  -e DATABASE_URL="postgresql://adpm:<password>@127.0.0.1:5432/adpm?connection_limit=5" \
  -e AUTH_SECRET="<from Secret Manager>" \
  -e AUTH_TRUST_HOST=true \
  -e ADPM_WORKSPACE_DIR=/var/lib/adpm/workspace \
  -v /var/lib/adpm/workspace:/var/lib/adpm/workspace \
  --network host \
  us-central1-docker.pkg.dev/<project>/adpm/adpm:1
```

Binding to `127.0.0.1` keeps it off the network until a load balancer or TLS proxy fronts it. The
volume mount is what makes the workspace mirror survive a redeploy — the reason to choose B if that
mirror matters to you.

Use **OS Login and IAP TCP forwarding** for shell access rather than opening SSH to the world.

---

## 6. Access control — use IAP

This is the section that compensates for B1. Cloud Run's own
`--no-allow-unauthenticated` gates on IAM service identities, which is right for
service-to-service but wrong for humans with browsers. For people, put an **external HTTPS load
balancer with a serverless NEG** in front of Cloud Run and enable **IAP** on the backend service,
then grant `roles/iap.httpsResourceAccessor` to the specific users or group who should get in.

The effect: an unauthenticated browser never reaches Node, and ADPM's sign-in page is visible only
to someone already authenticated as a Google identity you have named.

Get a managed certificate for a custom domain from the load balancer, and redirect HTTP to HTTPS.
Auth.js sets a session cookie; over plain HTTP that cookie is the whole session.

Then, before anyone else touches it:

- Confirm `AUTH_SECRET` comes from Secret Manager, not the placeholder (B2).
- Change the seeded passwords in the database, or accept that everyone who clears IAP shares an
  `admin@adpm.local` login.
- Decide whether the nine demo workspaces should exist on that instance at all.

---

## 7. Agents

Agents are off by default and every stage is completable without them, so the simplest deployment
leaves them off and is complete.

If you want them: store the key in Secret Manager and inject it as `ANTHROPIC_API_KEY` via
`--set-secrets`. Do **not** use the Admin key field on a hosted instance (B4) — on Cloud Run that
file is written to an in-memory filesystem that disappears with the instance.

Cloud Run has outbound internet by default. If you have attached a VPC connector with
`--vpc-egress all-traffic`, you will need Cloud NAT for the model API to be reachable — and Cloud
NAT costs more than the application.

Set the workspace budget cap deliberately; it is enforced in-process and can be overshot across
instances (C5).

---

## 8. Operations

**Scheduled monitoring.** `pnpm monitor` (DEPLOYMENT.md §6) is a script, not a service. On GCP the
clean shape is **Cloud Scheduler → Cloud Run Job**, using an admin image that includes dev
dependencies. It needs `ADPM_MONITOR_USER` set to the email of the human accountable for the
schedule, and refuses to start without one.

**Backups.** Enable Cloud SQL automated backups and point-in-time recovery. The database is the
system of record; the workspace mirror needs no backup, which on Cloud Run is just as well.

**Logs.** Cloud Run ships stdout to Cloud Logging automatically. ADPM writes its own audit trail to
the database — every gate decision, artifact version and agent action — so Cloud Logging is for
process health, not governance evidence.

**Updating.** Push a new tag and `gcloud run deploy` again; Cloud Run shifts traffic for you. If the
Prisma schema changed, run `prisma db push` through the proxy **before** the new revision serves
traffic.

---

## 9. Teardown

```bash
gcloud run services delete adpm --region us-central1
gcloud sql instances delete adpm-pg          # take a final export first if the data matters
gcloud artifacts repositories delete adpm --location us-central1
```

Then delete the load balancer, its forwarding rules and static IP, and Cloud NAT if you created
one. **The load balancer and Cloud NAT bill whether or not anyone is using them** — they are the
two things people forget, and on this deployment they can each cost more than the application.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| **Revision fails to start, "container failed to listen on PORT"** | The image is not honouring the injected `PORT`, or was built for arm64. The standalone server honours `PORT`; check the architecture first. |
| **`too many connections` under light load** | C6, and the classic Cloud Run failure here. Cap `--max-instances` and set `connection_limit` in `DATABASE_URL`. |
| **`could not connect to server` on Cloud Run** | Missing `--add-cloudsql-instances`, or a `DATABASE_URL` that is not in the `host=/cloudsql/...` unix-socket form. |
| **Memory climbs until the instance is recycled** | The workspace mirror writing to Cloud Run's in-memory filesystem. Set `ADPM_WORKSPACE_DIR=off` (needs B3). |
| **First request after idle takes many seconds** | Cold start with `--min-instances 0`. Set it to 1 for anything you will demo. |
| **Every artifact commit reports failure, but the version appears anyway** | B3 without the fix, on a read-only or full filesystem. The data is fine; the message is wrong. |
| **Sign-in fails for everyone after a deploy** | `AUTH_SECRET` changed, invalidating every issued JWT. Pin it to a Secret Manager version and clear cookies once. |
| **IAP returns 403 for a user who should have access** | They need `roles/iap.httpsResourceAccessor` on the backend service, not just project viewer. |
| **Seed wiped the database** | It is designed to (C2). Never run it against an instance holding real work. |

---

## 11. Summary — the honest position

Cloud Run is the cheapest of the three for an app that idles, and IAP is a strong identity boundary
in front of an application that has none of its own. Against that, Cloud Run is the platform where
ADPM's local-first assumptions chafe most: an in-memory filesystem that makes the workspace mirror
actively harmful, and aggressive autoscaling that meets Prisma's per-instance connection pool head
on.

Both are manageable — `ADPM_WORKSPACE_DIR=off` and a `--max-instances` cap — and both are things
you want to know before the demo, not during it.

As everywhere else, B1 remains. IAP controls who can reach ADPM; it does not give ADPM users.
Everyone who gets through still shares the seeded accounts, and building real user management is
still what separates this from a system a team can be handed.
