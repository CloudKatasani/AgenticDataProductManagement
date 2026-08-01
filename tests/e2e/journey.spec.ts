import { expect, test, type Page } from '@playwright/test'

/**
 * The demonstrable journey: a consumer searches, a practitioner works a stage, an agent proposes
 * and a human dispositions. These assert the real UI, not a mock.
 */

async function signIn(page: Page, email: string) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('adpm')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/inbox|marketplace|portfolio|admin/)
}

test('a consumer searches the marketplace and reads a listing assembled from artifacts', async ({
  page,
}) => {
  await signIn(page, 'consumer@adpm.local')
  await page.goto('/marketplace')
  await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible()

  await page.getByLabel('Search questions, entities and metrics').fill('arrears')
  await page.getByRole('button', { name: 'Apply' }).click()

  const listing = page.getByRole('link', { name: 'Arrears & Customer Protection' }).first()
  await expect(listing).toBeVisible()
  await listing.click()

  await expect(page.getByRole('heading', { name: 'Questions this product answers' })).toBeVisible()
  await expect(page.getByText('Certified metrics')).toBeVisible()
  await expect(page.getByText('Gates approved')).toBeVisible()
})

test('a consumer who finds nothing is pushed to describe the decision instead', async ({ page }) => {
  await signIn(page, 'consumer@adpm.local')
  await page.goto('/marketplace?q=zzzz-no-such-thing')
  await expect(page.getByText('Nothing here answers that question yet.')).toBeVisible()
  await page.getByRole('link', { name: 'Describe the decision you cannot make today' }).click()
  await expect(page.getByRole('heading', { name: 'Request a data product' })).toBeVisible()
  await expect(
    page.getByText("What decision are you trying to make that you can't make today?"),
  ).toBeVisible()
})

test('a practitioner sees live exit criteria and the gate panel on a stage', async ({ page }) => {
  await signIn(page, 'owner@adpm.local')
  await page.goto('/products')
  await page.getByRole('link', { name: 'Arrears & Customer Protection' }).first().click()
  await page.waitForURL(/\/products\/[^/]+$/)
  await page.getByRole('link', { name: /Open Stage/ }).first().click()
  await page.waitForURL(/\/stage\/\d+$/)

  await expect(page.getByText('Why this stage matters')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Exit criteria' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gate' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Audit timeline' })).toBeVisible()
})

test('an agent proposes and a human dispositions — nothing is applied automatically', async ({
  page,
}) => {
  await signIn(page, 'owner@adpm.local')
  await page.goto('/products')
  await page.getByRole('link', { name: 'Feeder Reliability' }).first().click()
  await page.waitForURL(/\/products\/[^/]+$/)
  await page.getByRole('link', { name: /Open Stage/ }).first().click()
  await page.waitForURL(/\/stage\/\d+$/)

  const agentPanel = page.locator('section', { hasText: 'Agent assist' }).first()
  await expect(agentPanel).toBeVisible()

  // The Critic produces review comments for disposition; the Steward only raises findings.
  await page.getByLabel('Agent').selectOption('critic')
  await page.getByRole('button', { name: 'Run agent' }).click()
  await expect(page.getByText('Nothing has been applied')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Not yet reviewed').first()).toBeVisible()

  // Reject every proposal so the demo database is left as it was found.
  const rejectButtons = page.getByRole('button', { name: 'Reject' })
  const count = await rejectButtons.count()
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name: 'Reject' }).first().click()
    await page.waitForLoadState('networkidle')
  }
})

test('the agents tab states plainly that no autonomy level clears a gate', async ({ page }) => {
  await signIn(page, 'admin@adpm.local')
  await page.goto('/agents')
  await expect(page.getByText('There is no autonomy level that clears a gate.')).toBeVisible()
  await expect(page.getByText('Proposal acceptance rate')).toBeVisible()
})

test('a guided tour drives the real UI and survives navigation', async ({ page }) => {
  await signIn(page, 'consumer@adpm.local')
  await page.goto('/academy')

  const tourCard = page
    .locator('article')
    .filter({ hasText: 'I need data and do not know where to start' })
  await tourCard.getByRole('button', { name: 'Start this tour' }).click()

  // The tour navigated us to the first step's real screen, and the overlay came with us.
  await page.waitForURL(/marketplace/)
  const overlay = page.getByRole('complementary', { name: /Guided tour/ })
  await expect(overlay).toBeVisible()
  await expect(overlay.getByText('Step 1 of 4')).toBeVisible()

  await overlay.getByRole('button', { name: 'Next' }).click()
  await expect(overlay.getByText('Step 2 of 4')).toBeVisible()

  await overlay.getByRole('button', { name: 'Next' }).click()
  await page.waitForURL(/request/)
  await expect(overlay.getByText('Step 3 of 4')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Request a data product' })).toBeVisible()

  await overlay.getByRole('button', { name: 'End the tour' }).click()
  await expect(overlay).toBeHidden()
})

test('stage 3 offers CSV profiling and stage 5 offers the Excel round trip', async ({ page }) => {
  await signIn(page, 'steward@adpm.local')
  await page.goto('/products')
  await page.getByRole('link', { name: 'Billing Exceptions' }).first().click()
  await page.waitForURL(/\/products\/[^/]+$/)

  const productUrl = page.url()
  await page.goto(`${productUrl}/stage/3`)
  await expect(page.getByRole('heading', { name: 'Profile a CSV extract' })).toBeVisible()
  await expect(page.getByText('never requires a live warehouse connection')).toBeVisible()

  await page.goto(`${productUrl}/stage/5`)
  await expect(page.getByRole('heading', { name: 'Attribute register — Excel round trip' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Export workbook' })).toBeVisible()
})
