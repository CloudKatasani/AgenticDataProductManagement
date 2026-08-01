import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { AGENTS, AGENT_FORBIDDEN_ACTIONS, agentMayEverDo, getAgent } from '@/lib/agents/registry'
import { AgentError, dispositionProposal, effectiveAutonomy, invokeAgent } from '@/lib/agents/runtime'
import { redactForAgent } from '@/lib/agents/redaction'
import { evaluateExitCriteria } from '@/lib/lifecycle/transitions'
import { allBlockingPassed } from '@/lib/lifecycle/criteria'
import { AUTONOMY_LEVELS } from '@/lib/domain/enums'
import { blueprintArtifacts, commit, createFixture, createProduct } from './helpers/fixtures'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('no autonomy level clears a gate', () => {
  it('caps every agent at L3 monitoring, and L3 is read-only', () => {
    for (const agent of AGENTS) {
      expect(AUTONOMY_LEVELS).toContain(agent.autonomyCeiling)
      expect(agent.autonomyCeiling).not.toBe('L4' as never)
      if (agent.autonomyCeiling === 'L3') {
        expect(agent.outputType).toBe('FINDINGS')
      }
    }
  })

  it('states in code that an agent may never approve, commit or publish', () => {
    for (const action of AGENT_FORBIDDEN_ACTIONS) {
      expect(agentMayEverDo(action)).toBe(false)
    }
  })

  it('will not let a workspace setting raise an agent above its registry ceiling', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    await prisma.agentSetting.update({
      where: { workspaceId_agentId: { workspaceId: fixture.workspaceId, agentId: 'discovery' } },
      data: { autonomyLevel: 'L3' },
    })
    const level = await effectiveAutonomy(fixture.workspaceId, getAgent('discovery')!)
    expect(level).toBe('L2')
  })
})

describe('agent runtime guardrails', () => {
  it('refuses to run when agents are disabled for the workspace', async () => {
    const fixture = await createFixture({ agentsEnabled: false })
    const product = await createProduct(fixture)
    await expect(
      invokeAgent({
        agentId: 'critic',
        workspaceId: fixture.workspaceId,
        productId: product.id,
        stageNumber: 1,
        userId: fixture.users.get('DATA_STEWARD')!,
        trigger: 'MANUAL',
      }),
    ).rejects.toBeInstanceOf(AgentError)
  })

  it('refuses to run an agent on a stage it is not chartered for', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    await expect(
      invokeAgent({
        agentId: 'discovery',
        workspaceId: fixture.workspaceId,
        productId: product.id,
        stageNumber: 5,
        userId: fixture.users.get('DATA_STEWARD')!,
        trigger: 'MANUAL',
      }),
    ).rejects.toBeInstanceOf(AgentError)
  })

  it('persists output as proposals, logs the action, and blocks submission until dispositioned', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)
    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])

    const before = await evaluateExitCriteria(product.id, 1)
    expect(allBlockingPassed(before)).toBe(true)

    const result = await invokeAgent({
      agentId: 'critic',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 1,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    expect(result.commentCount).toBeGreaterThan(0)

    // Guardrail 7: every invocation writes an auditable action.
    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: result.actionId } })
    expect(action.agentId).toBe('critic')
    expect(action.initiatedById).toBe(fixture.users.get('DATA_STEWARD')!)
    expect(action.inputHash).toHaveLength(64)
    expect(action.disposition).toBe('PENDING')

    // Guardrail 4: pending proposals block submission.
    const during = await evaluateExitCriteria(product.id, 1)
    expect(allBlockingPassed(during)).toBe(false)
    expect(during.find((c) => c.key === 'no-unreviewed-agent-fields')?.passed).toBe(false)

    // Guardrail 2: a human disposition is required, and unblocks it.
    const proposals = await prisma.agentProposal.findMany({ where: { agentActionId: result.actionId } })
    for (const proposal of proposals) {
      await dispositionProposal({
        proposalId: proposal.id,
        userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
        action: 'REJECT',
        note: 'Not this time',
      })
    }
    const after = await evaluateExitCriteria(product.id, 1)
    expect(allBlockingPassed(after)).toBe(true)
  })

  it('never dispositions the same proposal twice', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)
    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    const result = await invokeAgent({
      agentId: 'critic',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 1,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    const proposal = await prisma.agentProposal.findFirstOrThrow({
      where: { agentActionId: result.actionId },
    })
    await dispositionProposal({
      proposalId: proposal.id,
      userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
      action: 'ACCEPT',
    })
    await expect(
      dispositionProposal({
        proposalId: proposal.id,
        userId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
        action: 'REJECT',
      }),
    ).rejects.toBeInstanceOf(AgentError)
  })

  it('refuses to invoke an agent for a consumer, who holds no authoring role', async () => {
    // Invariant 10 at the engine: a session is not an entitlement. Invoking an agent spends
    // workspace budget and puts product content in front of a model, so it is authorised by role.
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    await expect(
      invokeAgent({
        agentId: 'critic',
        workspaceId: fixture.workspaceId,
        productId: product.id,
        stageNumber: 1,
        userId: fixture.users.get('DATA_CONSUMER')!,
        trigger: 'MANUAL',
      }),
    ).rejects.toThrow(/requires one of/i)
  })

  it('refuses to let a consumer disposition a proposal', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)
    await commit(fixture, product.id, 'decision-register', artifacts['decision-register'])
    const result = await invokeAgent({
      agentId: 'critic',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 1,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    const proposal = await prisma.agentProposal.findFirstOrThrow({
      where: { agentActionId: result.actionId },
    })
    await expect(
      dispositionProposal({
        proposalId: proposal.id,
        userId: fixture.users.get('DATA_CONSUMER')!,
        action: 'ACCEPT',
      }),
    ).rejects.toThrow(/requires one of/i)
    // And the proposal is untouched, so the exit criterion still blocks submission.
    const untouched = await prisma.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } })
    expect(untouched.state).toBe('PENDING')
  })

  it('refuses a scheduled run for an agent below L3, whatever the caller asks for', async () => {
    // The rule scripts/monitor.ts leans on: a SCHEDULE trigger is only ever honoured at L3.
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    await expect(
      invokeAgent({
        agentId: 'critic',
        workspaceId: fixture.workspaceId,
        productId: product.id,
        stageNumber: 1,
        userId: fixture.users.get('DATA_STEWARD')!,
        trigger: 'SCHEDULE',
      }),
    ).rejects.toThrow(/L3/)
  })

  it('stops when the workspace agent budget is exhausted', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    await prisma.workspace.update({
      where: { id: fixture.workspaceId },
      data: { agentBudgetUsd: 1, agentSpendUsd: 1 },
    })
    const product = await createProduct(fixture)
    await expect(
      invokeAgent({
        agentId: 'critic',
        workspaceId: fixture.workspaceId,
        productId: product.id,
        stageNumber: 1,
        userId: fixture.users.get('DATA_STEWARD')!,
        trigger: 'MANUAL',
      }),
    ).rejects.toThrow(/budget/i)
  })
})

describe('redaction before transmission', () => {
  it('redacts PII and restricted values, and withholds samples by default', () => {
    const { payload, redactedFields } = redactForAgent(
      {
        'attribute-register': {
          attributes: [
            {
              name: 'contact_email',
              entity: 'Customer',
              businessDefinition: 'Email',
              sourceLineage: 'cis.customer.email',
              datatype: 'string',
              nullable: true,
              allowedValues: '',
              sensitivity: 'RESTRICTED',
              pii: true,
              regulatoryFlags: [],
              derivation: '',
              steward: 'Priya',
              patternExposure: [],
            },
          ],
          parkingLot: [],
        },
        'profile-report': {
          datasets: [{ columns: [{ name: 'contact_email', sample: 'nadia@example.com' }] }],
        },
      },
      { allowSampleData: false },
    )

    const serialised = JSON.stringify(payload)
    expect(serialised).not.toContain('nadia@example.com')
    expect(redactedFields.length).toBeGreaterThan(0)
  })
})
