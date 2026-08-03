import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { findNearMatches } from '@/lib/requests/duplicates'
import { INTAKE_FIELD_STEP, readIntakeForm, validateIntake } from '@/lib/requests/intake'
import { REQUEST_TERMINAL_STATES } from '@/lib/domain/enums'
import { blueprintArtifacts, commit, createFixture, createProduct } from './helpers/fixtures'

afterAll(async () => {
  await prisma.$disconnect()
})

async function makeRequest(workspaceId: string, requesterId: string, state: string, reference: string) {
  return prisma.productRequest.create({
    data: {
      workspaceId,
      requesterId,
      reference,
      title: 'Weekly view of accounts in arrears with protection flags',
      state,
      decision: 'Which accounts to place on a payment plan rather than escalate this week',
      consumerRole: 'Credit & Collections Manager',
      questionsJson: JSON.stringify([
        'Which accounts crossed 60 days in arrears this week?',
        'Which of those accounts hold a protected flag?',
        'What is the expected recovery if we offer a plan?',
      ]),
      submittedAt: new Date(),
    },
  })
}

describe('intake and triage', () => {
  it('does not create a data product when a request is merely submitted', async () => {
    const fixture = await createFixture()
    const request = await makeRequest(
      fixture.workspaceId,
      fixture.users.get('DATA_CONSUMER')!,
      'SUBMITTED',
      `REQ-${Date.now()}`,
    )
    const linked = await prisma.dataProduct.findFirst({ where: { requestId: request.id } })
    expect(linked).toBeNull()
  })

  it('treats approved, declined and merged as terminal', () => {
    expect(REQUEST_TERMINAL_STATES).toContain('APPROVED')
    expect(REQUEST_TERMINAL_STATES).toContain('DECLINED')
    expect(REQUEST_TERMINAL_STATES).toContain('MERGED')
    expect(REQUEST_TERMINAL_STATES).not.toContain('INFO_REQUESTED')
  })

  it('keeps the decline reason visible to the requester', async () => {
    const fixture = await createFixture()
    const request = await makeRequest(
      fixture.workspaceId,
      fixture.users.get('DATA_CONSUMER')!,
      'SUBMITTED',
      `REQ-D-${Date.now()}`,
    )
    await prisma.productRequest.update({
      where: { id: request.id },
      data: {
        state: 'DECLINED',
        declineReason: 'No decision is named that this would unblock.',
        triagedAt: new Date(),
      },
    })
    const declined = await prisma.productRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(declined.state).toBe('DECLINED')
    expect(declined.declineReason).toBeTruthy()
  })

  it('detects a near-duplicate against a product with overlapping questions', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture, `arrears-${Date.now().toString(36)}`)
    const artifacts = blueprintArtifacts(fixture)
    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])

    const matches = await findNearMatches({
      workspaceId: fixture.workspaceId,
      decision: 'Which accounts to place on a payment plan this week rather than escalate',
      consumerRole: 'Credit & Collections Manager',
      questions: [
        'Which accounts crossed 60 days in arrears this week?',
        'Which of those accounts hold a protected or medically dependent flag?',
      ],
    })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]!.kind).toBe('PRODUCT')
  })

  it('detects a near-duplicate against another open request', async () => {
    const fixture = await createFixture()
    await makeRequest(
      fixture.workspaceId,
      fixture.users.get('DATA_CONSUMER')!,
      'SUBMITTED',
      `REQ-N-${Date.now()}`,
    )
    const matches = await findNearMatches({
      workspaceId: fixture.workspaceId,
      decision: 'Which accounts to place on a payment plan rather than escalate this week',
      consumerRole: 'Credit & Collections Manager',
      questions: ['Which accounts crossed 60 days in arrears this week?'],
    })
    expect(matches.some((match) => match.kind === 'REQUEST')).toBe(true)
  })
})

/**
 * The wizard builds its payload from state and validates it with the same schema the server uses,
 * so the second press of the button — "Submit anyway", after the duplicate check — carries the
 * requester's answers instead of a form React has already reset.
 */
function wizardPayload(overrides: Record<string, string> = {}, confirmed = false) {
  const answers: Record<string, string> = {
    title: 'Weekly view of accounts in arrears',
    decision: 'Which accounts to place on a payment plan rather than escalate this week',
    consumerRole: 'Credit & Collections Manager',
    peopleAffected: '12',
    cadence: 'Weekly',
    currentWorkaround: 'Three exports stitched together in a spreadsheet',
    timeTakenToday: 'About 4 hours a week',
    stakes: 'We escalate accounts that would have recovered, and miss the ones that will not.',
    quantifiedImpact: '',
    requiredFreshness: 'Daily by 07:00',
    preferredPatternKey: '',
    sensitivityNotes: '',
    ...overrides,
  }
  const payload = new FormData()
  for (const [field, value] of Object.entries(answers)) payload.set(field, value)
  for (const question of [
    'Which accounts crossed 60 days in arrears this week?',
    'Which of those accounts hold a protected flag?',
    'What is the expected recovery if we offer a plan?',
  ]) {
    payload.append('questions', question)
  }
  if (confirmed) payload.set('confirmed', 'true')
  return payload
}

describe('intake payload validation', () => {
  it('accepts a fully answered wizard payload', () => {
    const result = validateIntake(readIntakeForm(wizardPayload()))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.questions).toHaveLength(3)
      expect(result.data.peopleAffected).toBe(12)
    }
  })

  it('carries every answer through a confirmed resubmit', () => {
    const payload = wizardPayload({}, true)
    const result = validateIntake(readIntakeForm(payload))
    expect(result.ok).toBe(true)
    expect(payload.get('confirmed')).toBe('true')
    if (result.ok) expect(result.data.title).toBe('Weekly view of accounts in arrears')
  })

  it('names the step that owns a missing answer', () => {
    const result = validateIntake(readIntakeForm(wizardPayload({ requiredFreshness: '' })))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.field).toBe('requiredFreshness')
      expect(result.error.step).toBe(INTAKE_FIELD_STEP.requiredFreshness)
      expect(result.error.message).toBeTruthy()
    }
  })

  it('rejects an empty payload rather than failing silently', () => {
    const result = validateIntake(readIntakeForm(new FormData()))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.step).not.toBeNull()
  })

  it('maps every intake answer to a wizard step', () => {
    for (const field of Object.keys(readIntakeForm(wizardPayload()))) {
      expect(INTAKE_FIELD_STEP[field]).toBeTypeOf('number')
    }
  })
})
