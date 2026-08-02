import { expect, test, type Page } from '@playwright/test'

/**
 * Regression cover for a bug that made the switcher look broken: the page below changed workspace
 * but the header dropdown snapped back to the previous value, so the next click re-submitted the
 * stale slug and appeared to revert the switch.
 *
 * Note on what these wait for. The dropdown showing the slug you just picked proves nothing — an
 * uncontrolled `<select>` keeps whatever the user chose, whether or not the server agreed. So the
 * signal every helper waits on is **server-rendered evidence**: the workspace name the page itself
 * renders. Waiting on the select value instead makes these tests pass while the bug is present.
 */

const WORKSPACE_NAMES: Record<string, string> = {
  banking: 'Banking Workspace',
  healthcare: 'Healthcare Workspace',
  telecom: 'Telecom Workspace',
  insurance: 'Insurance Workspace',
  'utility-energy': 'Utility & Energy Workspace',
}

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('admin@adpm.local')
  await page.getByLabel('Password').fill('adpm')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(admin|inbox|marketplace|portfolio)/)
}

/** Switch, and wait for the server to confirm it before returning. */
async function switchTo(page: Page, slug: string) {
  await page.locator('#workspace').selectOption(slug)
  await page.getByRole('button', { name: 'Switch' }).click()
  await expect(page.getByText(`configuration for ${WORKSPACE_NAMES[slug]}`)).toBeVisible()
}

test('the switcher stays in step with the workspace the page is showing', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin')
  await expect(page.locator('#workspace')).toHaveValue('utility-energy')

  // The old bug surfaced on the second switch, so revisit one already used.
  for (const slug of ['banking', 'healthcare', 'telecom', 'banking']) {
    await switchTo(page, slug)
    await expect(page.locator('#workspace')).toHaveValue(slug)
  }
})

test('the chosen workspace survives a reload', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin')
  await switchTo(page, 'insurance')

  await page.reload()
  await expect(page.getByText('configuration for Insurance Workspace')).toBeVisible()
  await expect(page.locator('#workspace')).toHaveValue('insurance')
})

test('switching from a record page does not strand you on another workspace record', async ({
  page,
}) => {
  await signIn(page)
  await page.goto('/marketplace')
  await page.locator('a[href^="/marketplace/"]').first().click()
  await page.waitForURL(/\/marketplace\/[^/]+/)

  await page.locator('#workspace').selectOption('insurance')
  await page.getByRole('button', { name: 'Switch' }).click()

  // A product key from one workspace means nothing in another, so the switch returns to the
  // door's landing page rather than a deep link that is about to 404.
  await page.waitForURL(/\/(admin|inbox|marketplace|portfolio)$/)
  await expect(page.locator('#workspace')).toHaveValue('insurance')
})
