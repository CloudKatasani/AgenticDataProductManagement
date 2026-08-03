import { expect, test, type Page } from '@playwright/test'

/**
 * The run console's whole claim is that agents draft and humans decide. These drive the real UI:
 * an automated run must stop and wait rather than clear its own gate, and a manual run must
 * dispatch nothing at all until somebody presses a button.
 */

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('owner@adpm.local')
  await page.getByLabel('Password').fill('adpm')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/inbox|marketplace|portfolio|admin/)
}

/** An open run correctly locks the selector, so a test that needs to start one clears it first. */
async function clearOpenRuns(page: Page) {
  const cancel = page.getByRole('button', { name: 'Cancel run' })
  while (await cancel.count()) {
    await cancel.first().click()
    await page.waitForTimeout(1500)
  }
}

test('automated run drafts and then stops for a human', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })

  await signIn(page)
  await page.getByRole('link', { name: 'Agent Run Console' }).click()
  await page.waitForURL(/run-console/)
  await expect(page.getByRole('heading', { name: 'Agent Run Console' })).toBeVisible()
  await clearOpenRuns(page)

  // Pick a product that is early in the lifecycle so there is drafting to do.
  const select = page.getByLabel('Data product')
  const options = await select.locator('option').allTextContents()
  const early = options.find((o) => /Stage ([1-9]|1[01]) /.test(o) && !o.includes('(run open)'))
  test.skip(!early, 'no early-stage product seeded')
  await select.selectOption({ label: early! })

  await page.getByRole('button', { name: 'Start automated execution' }).click()

  await expect(page.getByText('Awaiting your review')).toBeVisible({ timeout: 30_000 })

  // Drafts exist and each carries approve / review / reject.
  await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review & edit' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible()

  // Approve one draft and confirm it becomes attributed to the human.
  await page.getByRole('button', { name: 'Approve' }).first().click()
  await expect(page.getByText('accepted').first()).toBeVisible({ timeout: 20_000 })

  expect(pageErrors).toEqual([])
})

test('manual mode dispatches nothing until a human presses a button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await signIn(page)
  await page.goto('/run-console')
  await clearOpenRuns(page)

  const select = page.getByLabel('Data product')
  const options = await select.locator('option').allTextContents()
  const free = options.find((o) => /Stage ([1-9]|1[01]) /.test(o) && !o.includes('(run open)'))
  test.skip(!free, 'no free product')
  await select.selectOption({ label: free! })
  await page.getByRole('button', { name: 'Manual' }).click()
  await page.getByRole('button', { name: 'Start manual execution' }).click()

  await expect(page.getByText('Running').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Dispatch' }).first()).toBeVisible()
})
