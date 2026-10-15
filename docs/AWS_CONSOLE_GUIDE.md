# Deploying ADPM to a new AWS account, step by step in the console

This is a click-by-click guide for someone who has a **brand-new AWS account** and has not used AWS
before. By the end you will have Agentic Data Product Management running at an `https://` address
that you can open in a browser and share with a small group.

Plan on **about 90 minutes**, most of it waiting for things to start.

> **How this guide relates to [AWS.md](AWS.md).** AWS.md describes the longer-term architecture
> (Docker image, RDS Postgres, optionally ECS). That path needs code changes that are **not in the
> repository yet** ([hosting-prerequisites.md](hosting-prerequisites.md): B3, B5, B6, and the
> untested Postgres path C1). This guide deliberately avoids all of them. It runs the app **exactly
> the way it runs on a laptop** (the tested path, with SQLite) on one EC2 server whose disk
> survives restarts, and puts Amazon CloudFront in front for HTTPS. Nothing has to change in the
> code.

---

## What you are building

```
 Your browser ──HTTPS──▶ CloudFront ──HTTP :3000──▶ EC2 server (Ubuntu)
  (https://dxxxx.cloudfront.net)      (only CloudFront      ├─ Node.js 22 + pnpm
                                       may connect)         ├─ ADPM (next start)
                                                            └─ SQLite file on the EBS disk
 You (admin) ──AWS console──▶ Session Manager (a terminal in the browser; no SSH keys, no port 22)
```

| Piece | What it is for | Rough cost (us-east-1, on-demand) |
|---|---|---|
| EC2 `t3.medium` (2 vCPU, 4 GB RAM) | Runs the app. 4 GB lets `pnpm build` finish without running out of memory | ~$30/month |
| 30 GB gp3 EBS disk | Holds the code, the SQLite database and the workspace mirror | ~$2.40/month |
| Elastic IP (public IPv4 address) | Gives the server a fixed address so CloudFront can always find it | ~$3.60/month |
| CloudFront distribution | Free HTTPS address, hides the server | Usually pennies at demo traffic |
| EBS snapshots (backups) | Daily copy of the disk | Under $1/month |

**Expect roughly $35–40/month while the server runs.** Prices change and vary by region; check the
[AWS Pricing Calculator](https://calculator.aws) before quoting a number. New AWS accounts often
receive promotional credits, which this will draw down first. Part 10 shows how to stop paying.

### Before you start: what is and is not safe

ADPM has **no user management yet** ([hosting-prerequisites.md](hosting-prerequisites.md) B1): no
sign-up, no password reset. The only accounts are the demo accounts created by the seed, all with
the password `adpm`, which is printed on the sign-in screen. This guide closes that gap as far as a
deployment can:

- You will **generate a real `AUTH_SECRET`** (B2) — Part 6.
- You will **replace every seeded password** with one only you know — Part 8. Do not skip it: until
  you do, anyone who finds the URL can sign in as Admin.
- Optionally, you can **allow only your office's IP addresses** through CloudFront — Part 9.

Treat the result as a **private demo or workshop environment**, not a production system holding
real company data.

---

## Part 1 — Secure the new account (15 minutes)

You only do this once per AWS account. It is the most important security step in this guide.

### 1.1 Add MFA to the root user

The email/password you created the account with is the **root user**. It can do anything, including
close the account. Protect it, then stop using it day to day.

1. Sign in at <https://console.aws.amazon.com> as the root user.
2. Click your **account name** (top-right) → **Security credentials**.
3. Under **Multi-factor authentication (MFA)** click **Assign MFA device**.
4. Device name: `root-mfa`. Choose **Authenticator app** (or a passkey/security key if you have
   one) → **Next**.
5. Follow the prompts: scan the QR code with Google Authenticator, Microsoft Authenticator,
   1Password or similar, then enter two consecutive codes → **Add MFA**.

### 1.2 Create an everyday admin user

1. In the search bar at the top of the console type **IAM** and open it.
2. Left menu → **Users** → **Create user**.
3. User name: `adpm-admin`. Tick **Provide user access to the AWS Management Console**.
   - If asked, choose **I want to create an IAM user**.
   - Choose **Custom password**, enter a strong one, and **untick** "Users must create a new
     password at next sign-in". → **Next**.
4. Permissions: choose **Attach policies directly**, search for `AdministratorAccess`, tick it →
   **Next** → **Create user**.
5. On the confirmation page, **copy the Console sign-in URL** (it looks like
   `https://123456789012.signin.aws.amazon.com/console`) and save it with the password.
6. Open the new user (**Users → adpm-admin**) → **Security credentials** tab → **Assign MFA
   device**, and repeat the MFA steps from 1.1 for this user.
7. **Sign out**, then sign in again using the sign-in URL from step 5 as `adpm-admin`.

**From here on, always work as `adpm-admin`, never as root.**

### 1.3 Pick a region and stay in it

The region selector is at the top-right (for example **N. Virginia** = `us-east-1`). Pick the region
closest to the people who will use the app — for example `us-east-1`, `eu-west-2` (London) or
`ap-south-1` (Mumbai) — and **check it is still selected before every step in Parts 3–5.** The most
common beginner mistake is creating a resource in one region and then looking for it in another.

(CloudFront and IAM are "Global" — the selector changes to Global on those pages. That is normal.)

### 1.4 Set a budget alert

So a mistake cannot quietly cost you money:

1. Search for **Billing and Cost Management** → left menu **Budgets** → **Create budget**.
2. Choose **Use a template (simplified)** → **Monthly cost budget**.
3. Budget name: `monthly-limit`. Budgeted amount: `50` (USD), or whatever you are comfortable with.
4. Email recipients: your email address → **Create budget**.

AWS will email you at 85% and 100% of that amount, and when the forecast exceeds it.

---

## Part 2 — Create a role so you can reach the server without SSH (5 minutes)

Instead of SSH keys and an open port 22, you will use **Session Manager**, which opens a terminal to
the server inside your browser. The server needs a permission (an **IAM role**) to allow that.

1. Open **IAM** → left menu **Roles** → **Create role**.
2. Trusted entity type: **AWS service**. Use case: **EC2** (select "EC2", the first option) →
   **Next**.
3. Search for `AmazonSSMManagedInstanceCore`, tick it → **Next**.
4. Role name: `adpm-ec2-role` → **Create role**.

---

## Part 3 — Create the server (15 minutes)

### 3.1 A firewall (security group)

1. Search for **EC2** and open it. **Check the region** (top-right).
2. Left menu → **Network & Security → Security Groups** → **Create security group**.
3. Security group name: `adpm-app-sg`. Description: `ADPM app - CloudFront only`.
   VPC: leave the **default VPC**.
4. **Inbound rules → Add rule:**
   - Type: **Custom TCP**
   - Port range: `3000`
   - Source: **Custom**, then click in the box next to it and type `cloudfront`. Choose the prefix
     list named **`com.amazonaws.global.cloudfront.origin-facing`** (it starts with `pl-`).
   - Description: `CloudFront to ADPM`
5. **Outbound rules:** leave the default (all traffic allowed — the server needs it to download
   software).
6. **Create security group**.

This means **only CloudFront** can talk to the app. Nobody can reach the server directly from the
internet, and there is no SSH port open at all.

> If you see an error about the rule count, the prefix list counts as many rules; make sure it is
> the only inbound rule in this group.

### 3.2 The server (EC2 instance)

1. Left menu → **Instances** → **Launch instances**.
2. **Name:** `adpm-server`.
3. **Application and OS Images:** choose **Ubuntu**, then **Ubuntu Server 24.04 LTS (HVM), SSD
   Volume Type**. Architecture: **64-bit (x86)**.
4. **Instance type:** `t3.medium`.
   *Do not pick `t3.micro` / `t2.micro` to save money — building the app needs about 2 GB of
   memory and will fail on a 1 GB machine.*
5. **Key pair (login):** choose **Proceed without a key pair (Not recommended)**. That warning is
   aimed at SSH users; you will use Session Manager instead.
6. **Network settings** → click **Edit**:
   - VPC: default. Subnet: **No preference**.
   - **Auto-assign public IP: Enable**.
   - Firewall: **Select existing security group** → choose `adpm-app-sg`.
7. **Configure storage:** change `8` to **`30`** GiB, type **gp3**.
8. Expand **Advanced details**:
   - **IAM instance profile:** choose `adpm-ec2-role`.
   - Leave everything else as default.
9. Click **Launch instance**, then **View all instances**.

Wait until **Instance state = Running** and **Status check = 2/2 checks passed** (2–4 minutes; use
the refresh button).

### 3.3 Give it a fixed address (Elastic IP)

Without this, the server's address changes every time it is stopped and started, and CloudFront
would lose it.

1. Left menu → **Network & Security → Elastic IPs** → **Allocate Elastic IP address** →
   **Allocate**.
2. Select the new address → **Actions → Associate Elastic IP address**.
3. Resource type: **Instance**. Instance: `adpm-server` → **Associate**.
4. Go back to **Instances**, select `adpm-server`, and in the **Details** tab copy the **Public IPv4
   DNS** value. It looks like `ec2-3-91-12-34.compute-1.amazonaws.com`. **Save it — you need it in
   Part 7.** (Make sure it contains the Elastic IP's numbers; refresh the page if it still shows the
   old one.)

---

## Part 4 — Open a terminal on the server (2 minutes)

1. **EC2 → Instances** → select `adpm-server` → **Connect** (top of the page).
2. Choose the **Session Manager** tab → **Connect**.
   - If the Connect button is greyed out with a message about SSM, wait 5 minutes and try again —
     the server takes a little while to register. If it still will not connect after 10 minutes,
     check that `adpm-ec2-role` is attached (**Actions → Security → Modify IAM role**), then
     **Instance state → Reboot**.
3. A black terminal opens in a new browser tab. Switch to the normal `ubuntu` user by typing:

```bash
sudo su - ubuntu
```

Your prompt should now end in `ubuntu@ip-...:~$`. **Every command in Parts 5, 6 and 8 is typed
here.** You can paste with right-click → Paste (or Ctrl+Shift+V / Cmd+V). Paste one block at a time
and wait for it to finish before the next.

> Session Manager closes the tab after about 20 minutes of inactivity. If that happens, reconnect
> and run `sudo su - ubuntu` again — nothing you installed is lost.

---

## Part 5 — Install the software (10 minutes)

### 5.1 Update Ubuntu and install Node.js 22

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y git curl ca-certificates sqlite3
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

The last line should print `v22.x.x`. (If `upgrade` shows a purple screen asking about restarting
services, press **Enter** to accept the defaults.)

### 5.2 Enable pnpm

```bash
sudo corepack enable
cd ~
git clone https://github.com/CloudKatasani/AgenticDataProductManagement.git
cd AgenticDataProductManagement
pnpm --version
```

The first `pnpm` call may ask `Do you want to continue? [Y/n]` while it downloads the exact pnpm
version the project pins — type `Y`. It should print `10.x.x`.

> **If the repository is private,** `git clone` will ask for a username and password. GitHub no
> longer accepts your account password here: create a **fine-grained personal access token** at
> GitHub → Settings → Developer settings → Personal access tokens, with **read-only Contents**
> access to this one repository, and paste it as the password.

### 5.3 Install dependencies

```bash
pnpm install --frozen-lockfile
```

Takes 1–3 minutes. It ends by creating `.env` and printing a note that `AUTH_SECRET` is a
placeholder — you fix that next.

---

## Part 6 — Configure, seed and build (10 minutes)

### 6.1 Set a real session secret

```bash
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env
cat .env
```

You should see three lines: `DATABASE_URL="file:./dev.db"`, an `AUTH_SECRET` that is a long random
string (**not** `adpm-local-development-secret-change-me`), and `AUTH_TRUST_HOST=true`.

**Never change `AUTH_SECRET` again** after people start using the app — doing so signs everyone out.
You will add one more line (`AUTH_URL`) in Part 7.

### 6.2 Create the database with the demo content

```bash
pnpm db:seed
```

This takes **2–3 minutes** and drives 73 demo data products through the real lifecycle engine. It
should finish with `Seed complete: { workspaces: 9, products: 73, ... }` and a line about signing
in with the password `adpm`.

> ⚠️ **`pnpm db:seed` and `pnpm db:reset` delete everything in the database and start again.**
> Run them now, once. Never run them again on this server once people have entered real work.

### 6.3 Build the production version

```bash
pnpm build
```

Takes 2–5 minutes and ends with a table of routes. If it says `Killed` or "JavaScript heap out of
memory", the instance is too small — see Troubleshooting.

### 6.4 Make the app start automatically

This registers ADPM as a background service that starts on boot and restarts if it crashes.

```bash
sudo tee /etc/systemd/system/adpm.service > /dev/null <<'EOF'
[Unit]
Description=Agentic Data Product Management
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/AgenticDataProductManagement
Environment=NODE_ENV=production
ExecStart=/home/ubuntu/AgenticDataProductManagement/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now adpm
sleep 5
sudo systemctl status adpm --no-pager
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/signin
```

`status` should say **active (running)** and the last line should print **`200`**. The app is now
running on the server — but you cannot reach it from your browser yet, because the firewall only
lets CloudFront in.

---

## Part 7 — Put CloudFront (HTTPS) in front (15 minutes, mostly waiting)

CloudFront gives you a free `https://xxxx.cloudfront.net` address with a valid certificate, and is
the only thing allowed to talk to your server.

### 7.1 Create the distribution

1. Search for **CloudFront** → **Create distribution**.
   - If the console offers a choice of **pricing plan**, choose **Pay as you go**.
   - If it starts a step-by-step wizard, give the distribution a name such as `adpm`, choose origin
     type **Other** (a custom origin), and look for **Customize origin settings** /
     **Customize cache settings** to reach the options below. The names are the same.
2. **Origin domain:** paste the **Public IPv4 DNS** from Part 3.3
   (`ec2-…compute-1.amazonaws.com`). Do **not** paste an IP address, and do not choose any of the
   suggested S3/load-balancer entries.
3. **Protocol:** **HTTP only**. **HTTP port:** `3000`.
4. **Response timeout** (under additional/advanced origin settings): `60` seconds, if shown.
5. **Default cache behavior:**
   - **Viewer protocol policy:** **Redirect HTTP to HTTPS**.
   - **Allowed HTTP methods:** **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**. (The app submits
     forms with POST; with the default GET/HEAD every button that saves something will fail.)
   - **Cache key and origin requests:** **Cache policy and origin request policy (recommended)**.
     - **Cache policy:** **CachingDisabled**.
     - **Origin request policy:** **AllViewer**.
   This combination makes CloudFront a pure pass-through: every page is personal to the signed-in
   user, so nothing should be cached, and the app needs to see the browser's cookies and headers.
6. **Web Application Firewall (WAF):** choose **Do not enable security protections** for now. (Part
   9 explains how to add an IP allow-list later.)
7. **Settings:** Price class **Use only North America and Europe** (cheapest; pick another if your
   users are elsewhere). Leave **Alternate domain name** and **Custom SSL certificate** empty.
8. **Create distribution**.

On the distribution's page, copy the **Distribution domain name** — something like
`d1abcd2efgh3ij.cloudfront.net`. **Status** shows "Deploying" for 5–15 minutes.

### 7.2 Tell the app its public address

Back in the **Session Manager** terminal (reconnect and `sudo su - ubuntu` if it closed). Replace
the example domain with yours:

```bash
cd ~/AgenticDataProductManagement
echo 'AUTH_URL="https://d1abcd2efgh3ij.cloudfront.net"' >> .env
sudo systemctl restart adpm
```

This tells the sign-in system that the app's public address is HTTPS, even though CloudFront talks
to the server over plain HTTP inside AWS.

### 7.3 Open it

When the distribution's **Last modified** column shows a date instead of "Deploying", open
`https://<your-distribution-domain>` in your browser. You should see the ADPM sign-in page.

**Do not share the link yet** — the demo passwords are still `adpm`. Do Part 8 first.

---

## Part 8 — Replace the demo passwords (5 minutes, mandatory)

There is no password-change screen in ADPM yet, so you set one directly in the database. This sets
**every** seeded account (all roles, all nine workspaces) to one new password that only you know and
then share deliberately.

In the Session Manager terminal:

```bash
cd ~/AgenticDataProductManagement
read -s -p "New password for all demo accounts: " NEW_PASSWORD; echo
export NEW_PASSWORD
node <<'EOF'
const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')
;(async () => {
  if (!process.env.NEW_PASSWORD || process.env.NEW_PASSWORD.length < 12) {
    throw new Error('Use a password of at least 12 characters.')
  }
  const prisma = new PrismaClient()
  const passwordHash = await hash(process.env.NEW_PASSWORD, 10)
  const result = await prisma.user.updateMany({ data: { passwordHash } })
  console.log(`Updated the password for ${result.count} users.`)
  await prisma.$disconnect()
})()
EOF
unset NEW_PASSWORD
```

(Typing the password shows nothing on screen — that is intentional.) It should print `Updated the
password for N users.`

Now check it worked: sign in at your CloudFront URL as `admin@adpm.local` with **`adpm`** — it must
be **rejected** — then with your new password — it must **succeed**.

> **Known gap:** the sign-in page still says "Every account uses the password 'adpm'" and pre-fills
> it, because that text is hard-coded for the laptop demo. Tell your users to ignore it. If you
> ever re-run the seed, the passwords go back to `adpm` and you must repeat this part.

---

## Part 9 — Optional: only allow your organisation's IP addresses

Because ADPM has no real user management, the strongest extra protection is to make the site
unreachable except from known networks (your office, your VPN).

1. Find your public IP: search "what is my IP" in a browser. Ask your IT team for the office/VPN
   ranges (they look like `203.0.113.0/24`).
2. **CloudFront → Distributions → your distribution → Security** tab → **Edit** (or **Enable** AWS
   WAF protections).
3. Enable protections, then open the linked **WAF web ACL**.
4. In **AWS WAF → IP sets** (set the region selector to **Global (CloudFront)**) → **Create IP
   set**: name `adpm-allowed`, IP version IPv4, add each address as `x.x.x.x/32` (single address)
   or the range your IT team gave you → **Create**.
5. In the web ACL → **Rules → Add rules → Add my own rules** → Rule type **IP set**, IP set
   `adpm-allowed`, action **Allow** → **Add rule**.
6. Set the web ACL's **Default action** to **Block** → **Save**.

AWS WAF costs roughly $5/month for the web ACL plus $1/month per rule. Test from a phone on mobile
data: it should be blocked (403).

---

## Part 10 — Look after it

### Daily backups (strongly recommended)

The whole system of record is one SQLite file on the server's disk. Snapshot the disk daily:

1. **EC2 → Instances → adpm-server → Storage** tab → click the **Volume ID** → **Tags** tab →
   **Manage tags** → add Key `Backup`, Value `adpm` → **Save**.
2. **EC2 → Elastic Block Store → Lifecycle Manager** → **Create lifecycle policy** → **EBS
   snapshot policy** → **Next**.
3. Target resource type **Volume**, target tag `Backup` = `adpm`. Description `adpm daily`.
   IAM role: **Default role**.
4. Schedule: **Daily**, every 24 hours, at a quiet time. Retention: **Count = 7** → **Create
   policy**.

To restore: create a volume from a snapshot and swap it in, or ask for help — but having the
snapshots is what makes that possible.

### Stopping it when nobody is using it

**EC2 → Instances → adpm-server → Instance state → Stop.** You stop paying for the server (you
still pay for the disk and Elastic IP, a few dollars a month). **Start** it again later; the app
starts itself, and the Elastic IP keeps the address the same, so CloudFront keeps working after a
minute or two.

### Updating to a newer version of ADPM

In Session Manager (`sudo su - ubuntu` first):

```bash
cd ~/AgenticDataProductManagement
cp prisma/dev.db ~/dev.db.backup-$(date +%F)      # safety copy of the database
git pull
pnpm install --frozen-lockfile
pnpm db:push                                       # applies any database schema changes
pnpm build
sudo systemctl restart adpm
```

**Never run `pnpm db:seed` or `pnpm db:reset` as part of an update** — they wipe the database. If
`pnpm db:push` warns that a change would lose data, stop and ask before accepting.

### Viewing logs

```bash
sudo journalctl -u adpm -n 100 --no-pager      # last 100 lines
sudo journalctl -u adpm -f                     # live; Ctrl+C to stop
```

### Agents (optional)

Agents are off by default and every stage works without them; with no API key they use a
deterministic local provider. To use a real Anthropic model, add your key to `.env` and restart:

```bash
echo 'ANTHROPIC_API_KEY="sk-ant-..."' >> ~/AgenticDataProductManagement/.env
sudo systemctl restart adpm
```

Then sign in as `admin@adpm.local` → **Admin** to enable agents for a workspace and set a **budget
cap**. Set the cap deliberately; it is what limits your Anthropic bill. The server can reach the
internet through its public IP, so no extra networking is needed.

---

## Part 11 — Removing everything

To stop all charges, delete in this order:

1. **CloudFront:** select the distribution → **Disable** → wait until it shows Disabled (up to 15
   minutes) → **Delete**.
2. **WAF** (if you did Part 9): delete the web ACL, then the IP set.
3. **EC2 → Instances:** `adpm-server` → **Instance state → Terminate**. This also deletes its disk
   — download anything you want to keep first.
4. **EC2 → Elastic IPs:** select the address → **Actions → Release Elastic IP addresses**.
   *An Elastic IP that is no longer attached to anything still costs money — this is the item
   people forget.*
5. **EC2 → Lifecycle Manager:** delete the policy. **EC2 → Snapshots:** delete the `adpm`
   snapshots.
6. **EC2 → Security Groups:** delete `adpm-app-sg`. **IAM → Roles:** delete `adpm-ec2-role`.

The next month's bill should show nothing for these services.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| **Session Manager "Connect" is greyed out** | Wait 5–10 minutes after launch. Check the instance has `adpm-ec2-role` (**Actions → Security → Modify IAM role**), then reboot it. |
| **`pnpm build` prints `Killed` or "heap out of memory"** | The instance has too little memory. Stop it → **Actions → Instance settings → Change instance type** → `t3.medium` or larger → Start, then rebuild. |
| **CloudFront shows `504 Gateway Timeout` or "could not connect to origin"** | On the server, `sudo systemctl status adpm` must say running and `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/signin` must print 200. Then check: the security group allows port 3000 from the CloudFront prefix list; the origin is the **Public IPv4 DNS** (not an IP) with **HTTP only, port 3000**; and the Elastic IP is still associated. |
| **CloudFront shows `403` with "Bad request" / "not configured to allow the HTTP request method"** | The behaviour's **Allowed HTTP methods** is still GET, HEAD. Edit the behaviour and choose GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE. |
| **Sign-in page loads, but signing in returns to the sign-in page or errors** | Check `AUTH_URL` in `.env` is exactly `https://<your-distribution-domain>` (with `https://`, no trailing slash), restart the service, clear the site's cookies, try again. Also check the **origin request policy is AllViewer** — without it the login cookie never reaches the app. |
| **Buttons that save something fail with an "invalid Server Actions request"** | Same cause: the origin request policy must be **AllViewer** so the app sees the browser's `Host` and `Origin` headers. |
| **Pages look stale or show another user's data** | The cache policy must be **CachingDisabled**. Fix it, then **Invalidations → Create invalidation** with path `/*`. |
| **The app stopped after a reboot** | `sudo systemctl enable --now adpm`, then check `sudo journalctl -u adpm -n 50`. |
| **"Can't reach database" / table does not exist** | You are not in `~/AgenticDataProductManagement`, or the seed never ran. `ls prisma/dev.db` should show the file. |
| **Everyone gets signed out at once** | `AUTH_SECRET` in `.env` changed. Leave it alone from now on; users sign in again. |
| **`git clone` asks for a password** | The repository is private — use a personal access token as described in Part 5.2. |

---

## What this guide does not give you

Stated plainly, so nobody is surprised later:

- **One server, no redundancy.** If the instance fails, the app is down until it is restarted or
  restored from a snapshot. Fine for a demo or workshop; not for a service people depend on.
- **No user management** (B1). Everyone shares the demo accounts; there is no per-person login,
  invite, password reset or deactivation. The IP allow-list in Part 9 is the real access control.
- **SQLite, not a managed database.** It is the store the application is tested on, and it is
  correct for one server. Moving to RDS Postgres is the path in [AWS.md](AWS.md), after the code
  changes in [hosting-prerequisites.md](hosting-prerequisites.md).
- **A `cloudfront.net` address.** Using your own domain name (e.g. `adpm.yourcompany.com`) needs a
  certificate in AWS Certificate Manager (in `us-east-1`) and a DNS record; it is not covered here.
- **Not verified end to end on AWS by the author of this guide.** The commands that run on the
  server are the project's own documented laptop commands. The password-replacement script was run
  against a locally seeded database, and sign-in was tested through a local stand-in for CloudFront
  (HTTPS in, plain HTTP to port 3000, browser headers passed through, `AUTH_URL` set). Real
  CloudFront, the security group and Session Manager were not exercised. The console click-paths are written against the AWS
  console as of late 2026; AWS renames buttons from time to time, so if a label differs, look for
  the closest equivalent — the settings themselves do not change.
