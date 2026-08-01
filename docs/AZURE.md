# Hosting Agentic Data Product Management on Azure

A step-by-step guide to run ADPM on Azure for a shared team demo, a client sandbox, or a workshop
environment.

> **Read [hosting-prerequisites.md](hosting-prerequisites.md) first.** ADPM was built local-first.
> Six things have to change in the code before it is hosted anywhere, and one of them —
> authentication — is a hard blocker for anything reachable beyond a trusted group. That document
> lists them with file references, and supplies the `Dockerfile` and `next.config.ts` change every
> cloud needs. **None of those changes are in the repository.** The `B*` and `C*` identifiers used
> below refer to it.

For local use, read [RUNNING.md](../RUNNING.md). For the operational reference behind both, see
[DEPLOYMENT.md](DEPLOYMENT.md). Sibling guides: [AWS](AWS.md), [GCP](GCP.md).

---

## 1. Why Azure is the easiest of the three for this application

Two Azure features address ADPM's two worst hosting problems directly, with no code:

- **App Service Authentication ("Easy Auth")** puts Microsoft Entra ID in front of the entire
  application before a single request reaches Node. That is a real answer to **B1** — the missing
  user management — rather than a wall around it. Only people in your tenant, or in a group you
  nominate, can reach the sign-in page at all. On AWS the equivalent needs an ALB plus a Cognito
  user pool; here it is a few CLI flags.
- **App Service persistent shared storage** gives the container a `/home` directory that survives
  restarts and is shared across instances. That makes the workspace mirror (**B3**) actually work
  in a managed platform, which it does not on Fargate or Cloud Run without extra mounts.

Neither removes the need for B1's real fix. Easy Auth controls *who can reach ADPM*; it does not
give ADPM per-user accounts, so everyone who gets through still signs in as one of the seeded
demo users. But it is the difference between "the internet can try passwords" and "only my
colleagues can see the login form".

---

## 2. Choose an architecture

| | **A — App Service for Containers + Flexible Server** | **B — Container Apps + Flexible Server** | **C — VM + Docker** |
|---|---|---|---|
| Best for | Almost everything here | Scale-to-zero, or an existing Container Apps estate | An existing VM estate, or full control |
| Auth in front (B1) | **Easy Auth — built in** | Requires Entra + a proxy, or Front Door | Roll your own |
| TLS + custom domain | Built in, free managed certificate | Built in | You configure it |
| Workspace mirror (B3) | **Works** via `/home` | Needs an Azure Files mount | Works — local disk |
| Health check (B6) | Optional | Required | Optional |
| Rough cost | ~$30–50/month | ~$25–45/month | ~$40–60/month |

**Start with A.** For this application, App Service is not the boring choice — it is the one whose
feature set happens to line up with what ADPM is missing.

Costs are order-of-magnitude for a B1/B1ms tier in a common region at list price. Check the
[Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) before quoting a number
to anyone.

**What will not work:** Azure Static Web Apps, and any Functions-only design. ADPM needs a
long-running Node process with a live database connection and Server Actions. There is no static
export to deploy.

---

## 3. Prerequisites

| Tool | Check |
|------|-------|
| Azure subscription with Contributor on a resource group | `az account show` |
| Azure CLI | `az version` |
| Docker | `docker --version` |
| The repo cloned and running locally per [RUNNING.md](../RUNNING.md) | `pnpm dev` works |
| The B3 and B5 changes made, and the image built and run locally | [hosting-prerequisites.md §4–5](hosting-prerequisites.md) |

```bash
az login
az group create --name adpm-rg --location eastus
```

---

## 4. Provision — Option A (App Service for Containers)

### 4.1 Container registry and image

```bash
az acr create --resource-group adpm-rg --name adpmacr --sku Basic
az acr login --name adpmacr

docker build -t adpmacr.azurecr.io/adpm:1 .
docker push adpmacr.azurecr.io/adpm:1
```

Build on an amd64 machine, or pass `--platform linux/amd64`. An arm64 image built on an Apple
Silicon laptop will push happily and then fail to start on App Service, with a message that does
not obviously say why.

### 4.2 Postgres

```bash
az postgres flexible-server create \
  --resource-group adpm-rg --name adpm-pg \
  --tier Burstable --sku-name Standard_B1ms \
  --version 16 --storage-size 32 \
  --database-name adpm \
  --public-access None
```

`--public-access None` puts it behind private networking. Reaching it from App Service then needs
VNet integration (§4.5). For a short-lived demo you may instead allow Azure services and restrict
by firewall rule — decide deliberately, and do not leave it open to `0.0.0.0`.

Store the connection string rather than passing it around:

```bash
az keyvault create --resource-group adpm-rg --name adpm-kv
az keyvault secret set --vault-name adpm-kv --name auth-secret \
  --value "$(openssl rand -base64 32)"
az keyvault secret set --vault-name adpm-kv --name database-url \
  --value "postgresql://<admin>:<password>@adpm-pg.postgres.database.azure.com:5432/adpm?sslmode=require&connection_limit=5"
```

`sslmode=require` is not optional — Flexible Server enforces TLS. `connection_limit=5` is C6: a
Burstable tier has a modest connection cap and Prisma pools per instance.

### 4.3 The web app

```bash
az appservice plan create --resource-group adpm-rg --name adpm-plan \
  --is-linux --sku B1

az webapp create --resource-group adpm-rg --plan adpm-plan --name adpm-app \
  --deployment-container-image-name adpmacr.azurecr.io/adpm:1

az webapp identity assign --resource-group adpm-rg --name adpm-app
```

Grant that managed identity `get` on Key Vault secrets, then reference them from app settings so no
secret is ever typed into a config blade or a script:

```bash
az webapp config appsettings set --resource-group adpm-rg --name adpm-app --settings \
  WEBSITES_PORT=3000 \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=true \
  AUTH_TRUST_HOST=true \
  ADPM_WORKSPACE_DIR=/home/adpm-workspace \
  DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://adpm-kv.vault.azure.net/secrets/database-url/)" \
  AUTH_SECRET="@Microsoft.KeyVault(SecretUri=https://adpm-kv.vault.azure.net/secrets/auth-secret/)"
```

Three of those matter more than they look:

- `WEBSITES_PORT=3000` — App Service otherwise guesses, and guesses wrong.
- `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` — **off by default for Linux containers.** This is what
  makes `/home` persistent and shared, and therefore what makes `ADPM_WORKSPACE_DIR` worth setting.
  Without it, set `ADPM_WORKSPACE_DIR=off` instead.
- `AUTH_TRUST_HOST=true` — Auth.js v5 behind the App Service front end.

### 4.4 Initialise the database

The seed is **destructive** (C2) and the runtime image deliberately does not carry it. Run the
schema push and the seed from your laptop, with the database temporarily reachable, or from a
one-off container in the same VNet:

```bash
export DATABASE_URL="postgresql://<admin>:<password>@adpm-pg.postgres.database.azure.com:5432/adpm?sslmode=require"
pnpm db:pg:setup     # derives the Postgres schema and pushes it
pnpm db:seed:pg      # demo data — only on a demo instance
```

Then remove whatever firewall rule you opened to do it.

### 4.5 Networking

For a private database: create a VNet with a subnet delegated to App Service, enable VNet
integration on the web app, and put the Flexible Server on a peered or same-VNet private endpoint.
For a demo where the database is firewalled to known IPs, you can skip this — but say out loud
which one you chose, because the difference matters and is invisible later.

---

## 5. Provision — Option B (Container Apps)

Same ACR, Key Vault and Flexible Server. Differences:

1. `az containerapp create` with `--target-port 3000 --ingress external`, secrets bound from Key
   Vault via managed identity.
2. **Set a health probe** (B6) — Container Apps wants one. `/api/health` once it exists, `/signin`
   until then.
3. **Cap replicas**: `--min-replicas 1 --max-replicas 2`. Container Apps scales aggressively by
   default and each replica opens its own Prisma pool (C6). A Burstable Postgres will run out of
   connections long before it runs out of CPU.
4. **The filesystem is ephemeral.** Set `ADPM_WORKSPACE_DIR=off`, or mount Azure Files as a volume
   if you want the git-friendly mirror.
5. Run the schema push and seed as a **Container Apps Job**, not as part of the app.

Scale-to-zero (`--min-replicas 0`) is tempting for a demo that is used twice a week. Be aware the
first request after idle pays a cold start that includes Next.js boot and a fresh Prisma
connection — several seconds, which is exactly when the person you are demoing to is watching.

---

## 6. Access control — use Easy Auth

This is the section that compensates for B1, and on Azure it is genuinely good:

```bash
az webapp auth microsoft update --resource-group adpm-rg --name adpm-app \
  --client-id <entra-app-client-id> \
  --client-secret <entra-app-client-secret> \
  --issuer https://login.microsoftonline.com/<tenant-id>/v2.0

az webapp auth update --resource-group adpm-rg --name adpm-app \
  --enabled true --action RedirectToLoginPage --redirect-provider azureactivedirectory
```

With `--action RedirectToLoginPage`, an anonymous request never reaches Node. ADPM's own sign-in
page is only visible to someone who has already authenticated against your tenant. Restrict further
by assigning the Entra application to a specific group and requiring assignment.

App Service gives you HTTPS on `*.azurewebsites.net` out of the box, and a free managed certificate
for a custom domain. **Set HTTPS-only** so the session cookie is never sent in clear:

```bash
az webapp update --resource-group adpm-rg --name adpm-app --https-only true
```

Then, before anyone else touches it:

- Confirm `AUTH_SECRET` is the Key Vault value, not the placeholder (B2).
- Change the seeded passwords in the database, or accept that everyone who clears Easy Auth shares
  an `admin@adpm.local` login.
- Decide whether the nine demo workspaces should exist on that instance at all.

---

## 7. Agents

Agents are off by default and every stage is completable without them, so the simplest deployment
leaves them off and is complete.

If you want them: put the key in Key Vault, reference it as `ANTHROPIC_API_KEY` in app settings,
and do **not** use the Admin key field on a hosted instance (B4) — it writes to a container-local
file that vanishes on restart. Set the workspace budget cap deliberately; it is enforced in-process
and can be overshot across replicas (C5).

App Service and Container Apps both have outbound internet by default, so unlike a private-subnet
deployment on AWS there is no NAT gateway line item to plan for.

---

## 8. Operations

**Scheduled monitoring.** `pnpm monitor` (DEPLOYMENT.md §6) is a script, not a service. On Azure,
run it as a **Container Apps Job** on a cron schedule, using an admin image that includes dev
dependencies. It needs `ADPM_MONITOR_USER` set to the email of the human accountable for the
schedule, and refuses to start without one.

**Backups.** Flexible Server has automated backups; set the retention you actually want. The
database is the system of record. The `/home` workspace mirror needs no backup.

**Logs.** `az webapp log tail`, or wire Application Insights. ADPM writes its own audit trail to the
database — every gate decision, artifact version and agent action — so Azure logging is for process
health, not governance evidence.

**Updating.** Push a new tag, then `az webapp config container set` and restart. If the Prisma
schema changed, run `prisma db push` **before** the new image serves traffic.

---

## 9. Teardown

```bash
az group delete --name adpm-rg --yes --no-wait
```

One resource group holding everything is the reason to create it that way at the start. Check
afterwards that the Key Vault is actually gone rather than soft-deleted, and purge it if you intend
to reuse the name — soft-delete will otherwise block recreating it.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| **Container starts then stops, no useful error** | Architecture mismatch — an arm64 image on an amd64 plan. Rebuild with `--platform linux/amd64`. |
| **App Service shows the default page, container never gets traffic** | `WEBSITES_PORT` not set to 3000. |
| **Every artifact commit reports failure, but the version appears anyway** | B3, plus `WEBSITES_ENABLE_APP_SERVICE_STORAGE` not set — `/home` is not writable, and the mirror throws after the transaction commits. The data is fine. |
| **`no pg_hba.conf entry` / SSL required** | `sslmode=require` missing from `DATABASE_URL`. Flexible Server enforces TLS. |
| **`too many connections`** | C6. Cap replicas and add `connection_limit=5` to `DATABASE_URL`. |
| **Sign-in fails for everyone after a redeploy** | `AUTH_SECRET` changed, invalidating every issued JWT. Reference it from Key Vault so it is stable, and clear cookies once. |
| **Easy Auth redirect loop** | The Entra app registration's redirect URI does not match `https://<app>.azurewebsites.net/.auth/login/aad/callback`. |
| **Agent runs fail with a network error** | Only if you have restricted outbound. Default App Service egress is open. |
| **Seed wiped the database** | It is designed to (C2). Never run it against an instance holding real work. |

---

## 11. Summary — the honest position

Azure is the best fit of the three clouds for ADPM as it stands today, for two specific reasons:
Easy Auth gives a real identity boundary in front of an application that has none of its own, and
App Service's persistent `/home` is the only managed option among the three where the workspace
mirror works without bolting on a separate filesystem.

That still leaves B1 unfixed. Easy Auth controls who can reach ADPM; it does not give ADPM users.
Everyone who gets through the door still shares the seeded accounts, and building real user
management remains the thing that separates this from a system a team can be given.
