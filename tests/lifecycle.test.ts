import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  evaluateExitCriteria,
  recordDecision,
  requestTransition,
  TransitionError,
} from '@/lib/lifecycle/transitions'
import { allBlockingPassed } from '@/lib/lifecycle/criteria'
import { AuthorisationError } from '@/lib/auth/authorise'
import { blueprintArtifacts, commit, createFixture, createProduct } from './helpers/fixtures'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('the gate engine, end to end', () => {
  it('fails a gate, accepts a fix, then passes it — with agents disabled throughout', async () => {
    const fixture = await createFixture({ agentsEnabled: false })
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)

    // 1. Nothing committed: the stage cannot be submitted.
    await expect(
      requestTransition({
        productId: product.id,
        stageNumber: 1,
        action: 'SUBMIT_FOR_REVIEW',
        userId: fixture.users.get('DATA_STEWARD')!,
      }),
    ).rejects.toBeInstanceOf(TransitionError)

    // 2. A schema-valid register that still fails the exit criteria: the schema catches shape,
    //    the criteria catch meaning. Naming "the business" as the consumer is a criteria failure.
    await commit(fixture, product.id, 'decision-register', {
      decisions: [
        {
          id: 'DR-1',
          consumerPersona: 'The business',
          decision: 'Which accounts to place on a payment plan',
          cadence: 'Weekly',
          currentWorkaround: 'A spreadsheet built by hand each week',
          latencyTolerance: 'Daily',
          consequence: 'Recoverable arrears age past recovery',
          questions: ['q one?', 'q two?', 'q three?'],
        },
      ],
    })
    const partial = await evaluateExitCriteria(product.id, 1)
    expect(allBlockingPassed(partial)).toBe(false)
    expect(partial.find((c) => c.key === 'named-persona')?.passed).toBe(false)

    // 3. Fix it and the criteria pass.
    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    const fixed = await evaluateExitCriteria(product.id, 1)
    expect(allBlockingPassed(fixed)).toBe(true)

    await requestTransition({
      productId: product.id,
      stageNumber: 1,
      action: 'SUBMIT_FOR_REVIEW',
      userId: fixture.users.get('DATA_STEWARD')!,
    })
    await requestTransition({
      productId: product.id,
      stageNumber: 1,
      action: 'OPEN_GATE',
      userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
    })

    const gate = await prisma.gate.findFirstOrThrow({
      where: { productId: product.id, stageNumber: 1 },
    })

    // 4. A user without an approver role cannot vote.
    await expect(
      recordDecision({
        gateId: gate.id,
        userId: fixture.users.get('DATA_ENGINEER')!,
        decision: 'APPROVE',
      }),
    ).rejects.toBeInstanceOf(AuthorisationError)

    // 5. One approval is not quorum.
    const first = await recordDecision({
      gateId: gate.id,
      userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
      roleKey: 'DOMAIN_PRODUCT_OWNER',
      decision: 'APPROVE',
    })
    expect(first.gateState).toBe('OPEN')

    const second = await recordDecision({
      gateId: gate.id,
      userId: fixture.users.get('DOMAIN_SME')!,
      roleKey: 'DOMAIN_SME',
      decision: 'APPROVE',
    })
    expect(second.gateState).toBe('APPROVED')

    // 6. Approval snapshots the evidence it rests on, and opens the next stage.
    const evidence = await prisma.gateEvidence.findMany({ where: { gateId: gate.id } })
    expect(evidence.length).toBeGreaterThan(0)
    const updated = await prisma.dataProduct.findUniqueOrThrow({ where: { id: product.id } })
    expect(updated.currentStage).toBe(2)

    // 7. The whole thing is in the audit trail.
    const events = await prisma.auditEvent.findMany({ where: { productId: product.id } })
    const actions = events.map((event) => event.action)
    expect(actions).toContain('artifact.committed')
    expect(actions).toContain('stage.submitted_for_review')
    expect(actions).toContain('gate.opened')
    expect(actions).toContain('gate.approved')
  })

  it('flips an approved gate to STALE when its evidence changes, and raises a re-approval task', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)

    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    await requestTransition({
      productId: product.id,
      stageNumber: 1,
      action: 'SUBMIT_FOR_REVIEW',
      userId: fixture.users.get('DATA_STEWARD')!,
    })
    await requestTransition({
      productId: product.id,
      stageNumber: 1,
      action: 'OPEN_GATE',
      userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
    })
    const gate = await prisma.gate.findFirstOrThrow({
      where: { productId: product.id, stageNumber: 1 },
    })
    await recordDecision({
      gateId: gate.id,
      userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
      roleKey: 'DOMAIN_PRODUCT_OWNER',
      decision: 'APPROVE',
    })
    await recordDecision({
      gateId: gate.id,
      userId: fixture.users.get('DOMAIN_SME')!,
      roleKey: 'DOMAIN_SME',
      decision: 'APPROVE',
    })
    expect((await prisma.gate.findUniqueOrThrow({ where: { id: gate.id } })).state).toBe('APPROVED')

    // Commit a new version of the artifact the approval relied on.
    const register = artifacts['decision-register'] as { decisions: { questions: string[] }[] }
    const changed = {
      decisions: register.decisions.map((decision) => ({
        ...decision,
        questions: [...decision.questions, 'A newly added question?'],
      })),
    }
    const result = await commit(fixture, product.id, 'decision-register', changed)
    expect(result.staledGateIds).toContain(gate.id)

    const after = await prisma.gate.findUniqueOrThrow({ where: { id: gate.id } })
    expect(after.state).toBe('STALE')
    expect(after.staleReason).toBeTruthy()

    const task = await prisma.task.findFirst({ where: { gateId: gate.id, kind: 'RE_APPROVAL' } })
    expect(task).toBeTruthy()
  })

  it('keeps artifact versions immutable and append-only', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)

    const first = await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    const unchanged = await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    expect(unchanged.unchanged).toBe(true)
    expect(unchanged.version).toBe(first.version)

    const register = artifacts['decision-register'] as { decisions: { questions: string[] }[] }
    const second = await commit(fixture, product.id, 'decision-register', {
      decisions: register.decisions.map((decision) => ({
        ...decision,
        questions: [...decision.questions, 'Another question?'],
      })),
    })
    expect(second.version).toBe(first.version + 1)
    expect(second.contentHash).not.toBe(first.contentHash)

    const versions = await prisma.artifactVersion.findMany({
      where: { artifactId: first.artifactId },
      orderBy: { version: 'asc' },
    })
    expect(versions).toHaveLength(2)
    // The original row is untouched — its hash is still the one the approval cited.
    expect(versions[0]!.contentHash).toBe(first.contentHash)
  })

  it('rejects an artifact that fails its schema', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture)
    await expect(
      commit(fixture, product.id, 'decision-register', { decisions: [{ id: 'DR-1' }] }),
    ).rejects.toThrow(/failed schema validation/i)
  })
})
