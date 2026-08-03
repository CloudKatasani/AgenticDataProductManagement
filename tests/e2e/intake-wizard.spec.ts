import { expect, test, type Page } from '@playwright/test'

/**
 * The intake wizard spans five steps, so most of its answers are always off screen. These assert
 * the two ways that used to break the submit button: answers wiped by the form reset React performs
 * once an action resolves, and a required answer on a hidden step that the browser refused to
 * submit without saying so.
 */

async function signInAsConsumer(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('consumer@adpm.local')
  await page.getByLabel('Password').fill('adpm')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/inbox|marketplace|portfolio|admin/)
}

const ANSWERS = {
  title: 'Weekly view of accounts in arrears with protection flags',
  decision: 'Which accounts to place on a payment plan rather than escalate this week',
  consumerRole: 'Credit & Collections Manager',
  peopleAffected: '12',
  cadence: 'Weekly',
  currentWorkaround: 'Three exports stitched together in a spreadsheet every Monday',
  timeTakenToday: 'About 4 hours a week',
  stakes: 'We escalate accounts that would have recovered and miss the ones that will not.',
  requiredFreshness: 'Daily by 07:00',
}

const QUESTIONS = [
  'Which accounts crossed 60 days in arrears this week?',
  'Which of those accounts hold a protected or medically dependent flag?',
  'What is the expected recovery if we offer a payment plan?',
]

test('submit anyway files the request after the duplicate check', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await signInAsConsumer(page)
  await page.goto('/request/new')

  await page.getByLabel('Give this request a short title').fill(ANSWERS.title)
  await page.getByLabel("What decision are you trying to make that you can't make today?").fill(ANSWERS.decision)

  await page.getByRole('button', { name: '2. You and your team' }).click()
  await page.getByLabel('Who is blocked?').fill(ANSWERS.consumerRole)
  await page.getByLabel('How many people are affected?').fill(ANSWERS.peopleAffected)
  await page.getByLabel('How often does this decision recur?').fill(ANSWERS.cadence)
  await page.getByLabel('What do you do today instead?').fill(ANSWERS.currentWorkaround)
  await page.getByLabel('How long does that take?').fill(ANSWERS.timeTakenToday)

  await page.getByRole('button', { name: '3. The questions' }).click()
  for (const [index, question] of QUESTIONS.entries()) {
    await page.getByLabel(`Question ${index + 1}`).fill(question)
  }

  await page.getByRole('button', { name: '4. The stakes' }).click()
  await page.getByLabel('What happens if the decision is not made, or made badly?').fill(ANSWERS.stakes)

  await page.getByRole('button', { name: '5. Constraints' }).click()
  await page.getByLabel('How fresh does the data need to be?').fill(ANSWERS.requiredFreshness)

  // First press: the duplicate check.
  await page.getByRole('button', { name: 'Check for duplicates and submit' }).click()
  await expect(page.getByText(/existing product\(s\) may already answer this/)).toBeVisible()

  const submitAnyway = page.getByRole('button', { name: 'Submit anyway' })
  await expect(submitAnyway).toBeVisible()

  // The answers must survive the round trip — this is what used to be wiped.
  await page.getByRole('button', { name: '1. The decision' }).click()
  await expect(page.getByLabel('Give this request a short title')).toHaveValue(ANSWERS.title)
  await page.getByRole('button', { name: '3. The questions' }).click()
  await expect(page.getByLabel('Question 1')).toHaveValue(QUESTIONS[0]!)

  // Second press: submit anyway.
  await submitAnyway.click()
  await expect(page.getByText(/^Submitted as REQ-/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Follow its status' })).toBeVisible()

  // The wizard clears so the next request does not start pre-filled.
  await expect(page.getByLabel('Give this request a short title')).toHaveValue('')

  expect(pageErrors).toEqual([])
})

test('an incomplete answer on a hidden step reports itself instead of doing nothing', async ({
  page,
}) => {
  await signInAsConsumer(page)
  await page.goto('/request/new')
  await page.getByLabel('Give this request a short title').fill(ANSWERS.title)
  await page.getByLabel("What decision are you trying to make that you can't make today?").fill(ANSWERS.decision)

  // Everything after step 1 is left blank; the button must say why, not sit there.
  await page.getByRole('button', { name: 'Check for duplicates and submit' }).click()
  const alert = page.locator('p[role="alert"]')
  await expect(alert).toContainText('Name a specific role.')
  await expect(alert).toContainText('step 2, You and your team')
  await expect(page.getByLabel('Who is blocked?')).toBeFocused()
})
