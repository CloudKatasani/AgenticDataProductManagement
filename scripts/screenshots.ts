/**
 * `pnpm screenshots` — capture every tab and page as evidence.
 *
 * Runs against a real, seeded, running server: it signs in as the role each door belongs to,
 * because roles are enforced server-side and a screenshot taken as the wrong user would show a
 * refusal rather than the screen. Product and request ids are discovered by navigation rather
 * than hard-coded, so this keeps working after a reseed.
 *
 *   pnpm build && PORT=3000 pnpm start &
 *   pnpm screenshots                       # writes docs/screenshots/
 *   ADPM_SCREENSHOT_BASE=http://localhost:3111 pnpm screenshots
 */
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'

const BASE = process.env.ADPM_SCREENSHOT_BASE ?? 'http://localhost:3000'
const OUT = join(process.cwd(), 'docs/screenshots')
const PASSWORD = 'adpm'

/** 1400 wide exercises the desktop layout without producing enormous files. */
const VIEWPORT = { width: 1400, height: 900 }

interface Shot {
  file: string
  title: string
  path: string
  as: string
}

const captured: Shot[] = []

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(admin|inbox|marketplace|portfolio)/, { timeout: 15_000 })
}

async function shot(page: Page, file: string, title: string, path: string, as: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  // Mermaid diagrams and the tour overlay settle a beat after load.
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${file}.png`), fullPage: true })
  captured.push({ file: `${file}.png`, title, path, as })
  process.stdout.write(`  ✓ ${file}.png  ${path}\n`)
}

/** First matching href on the current page, so ids are never hard-coded. */
async function firstHref(page: Page, selector: string): Promise<string | undefined> {
  const href = await page.locator(selector).first().getAttribute('href')
  return href ?? undefined
}

async function captureConsumer(browser: Browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })
  process.stdout.write('\nConsumer door (consumer@adpm.local)\n')
  await signIn(page, 'consumer@adpm.local')

  await shot(page, '01-marketplace', 'Marketplace', '/marketplace', 'Data Consumer')
  const listing = await firstHref(page, 'a[href^="/marketplace/"]')
  if (listing) {
    await shot(page, '02-marketplace-detail', 'Marketplace — product detail', listing, 'Data Consumer')
  }
  await shot(page, '03-request-new', 'Request — intake wizard', '/request/new', 'Data Consumer')
  await shot(page, '04-request-mine', 'Request — my requests', '/request', 'Data Consumer')
  const request = await firstHref(page, 'a[href^="/request/"]:not([href="/request/new"])')
  if (request) {
    await shot(page, '05-request-detail', 'Request — detail and triage history', request, 'Data Consumer')
  }
  await page.close()
}

async function capturePractitioner(browser: Browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })
  process.stdout.write('\nPractitioner door (owner@adpm.local)\n')
  await signIn(page, 'owner@adpm.local')

  await shot(page, '06-my-work', 'My Work — approvals, reviews, tasks', '/inbox', 'Domain Product Owner')
  await shot(page, '07-products', 'Products', '/products', 'Domain Product Owner')

  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' })
  const product = await firstHref(page, 'a[href^="/products/"]')
  if (!product) throw new Error('No product link found on /products — is the database seeded?')

  await shot(page, '08-product-overview', 'Lifecycle Studio — product overview', product, 'Domain Product Owner')
  for (let stage = 1; stage <= 12; stage += 1) {
    await shot(
      page,
      `09-stage-${String(stage).padStart(2, '0')}`,
      `Lifecycle Studio — Stage ${stage}`,
      `${product}/stage/${stage}`,
      'Domain Product Owner',
    )
  }
  await page.close()
}

async function captureLeadership(browser: Browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })
  process.stdout.write('\nLeadership door (cdo@adpm.local)\n')
  await signIn(page, 'cdo@adpm.local')
  await shot(page, '10-portfolio', 'Portfolio — pipeline, value, cost, maturity', '/portfolio', 'Portfolio Lead / CDO')
  await page.close()
}

async function captureEnable(browser: Browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })
  process.stdout.write('\nEnable and Run (admin@adpm.local)\n')
  await signIn(page, 'admin@adpm.local')

  await shot(page, '11-patterns', 'Consumption Patterns', '/patterns', 'Admin')
  await shot(page, '12-agents', 'Agents — charters, models, external context', '/agents', 'Admin')
  await shot(page, '13-academy', 'Academy — teaching layer and RACI', '/academy', 'Admin')

  await page.goto(`${BASE}/academy`, { waitUntil: 'networkidle' })
  const guide = await firstHref(page, 'a[href^="/academy/"]')
  if (guide) await shot(page, '14-academy-guide', 'Academy — a guide', guide, 'Admin')

  await shot(page, '15-admin', 'Admin — packs, roles, controls, standards', '/admin', 'Admin')
  await page.close()
}

async function captureSignedOut(browser: Browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })
  process.stdout.write('\nSigned out\n')
  await shot(page, '00-signin', 'Sign in', '/signin', 'signed out')
  await page.close()
}

async function writeIndex() {
  const rows = captured
    .map((s) => `| [\`${s.file}\`](${s.file}) | ${s.title} | \`${s.path}\` | ${s.as} |`)
    .join('\n')

  const files = await readdir(OUT)
  let bytes = 0
  for (const file of files) {
    if (file.endsWith('.png')) bytes += (await stat(join(OUT, file))).size
  }

  const body = `# Screenshots

Evidence that every tab and page renders against the seeded database. Captured by
\`pnpm screenshots\` (\`scripts/screenshots.ts\`) driving a real browser against a running
server — not mock-ups, and not hand-assembled.

Each was taken as the role that door belongs to, because roles are enforced server-side: a
screenshot taken as the wrong user would show a refusal rather than the screen. Product and
request ids are discovered by navigation, so re-running after a reseed just works.

${captured.length} images, ${(bytes / 1024 / 1024).toFixed(1)} MB total, viewport ${VIEWPORT.width}×${VIEWPORT.height}, full page.

## Regenerating

\`\`\`bash
pnpm db:seed && pnpm build
PORT=3000 pnpm start &
pnpm screenshots
\`\`\`

## Index

| File | Screen | Path | Signed in as |
|---|---|---|---|
${rows}
`
  await writeFile(join(OUT, 'README.md'), body, 'utf8')
}

async function main() {
  await mkdir(OUT, { recursive: true })
  process.stdout.write(`Capturing ${BASE} → docs/screenshots\n`)

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  try {
    await captureSignedOut(browser)
    await captureConsumer(browser)
    await capturePractitioner(browser)
    await captureLeadership(browser)
    await captureEnable(browser)
  } finally {
    await browser.close()
  }

  await writeIndex()
  process.stdout.write(`\n${captured.length} screenshot(s) written to docs/screenshots\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
