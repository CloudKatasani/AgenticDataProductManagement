import { hash } from 'bcryptjs'
import { prisma } from '../src/lib/db'
import { ROLES, type RoleKey } from '../src/lib/domain/roles'
import { STAGES, getStage } from '../src/lib/lifecycle/stages'
import { AGENTS } from '../src/lib/agents/registry'
import { CONSUMPTION_PATTERNS, evaluatePatternReadiness } from '../src/lib/patterns/registry'
import { loadAllPacks } from '../src/lib/packs/loader'
import { buildBlueprintArtifacts, buildScorecard } from '../src/lib/packs/blueprint'
import { artifactTypesForStage, getArtifactType } from '../src/lib/artifacts/registry'
import { commitArtifact } from '../src/lib/artifacts/commit'
import { ensureStageRun, recordDecision, requestTransition } from '../src/lib/lifecycle/transitions'
import { buildStageContext } from '../src/lib/lifecycle/context'
import type { Pack, PackSeedProduct } from '../src/lib/packs/schema'

/**
 * The seed drives every demo product through the real transition engine — the same
 * requestTransition() and recordDecision() calls a human makes in the UI. Nothing here writes a
 * gate state directly, which is exactly the point: if the engine is broken, the seed fails.
 */

const NOW = new Date('2026-08-01T09:00:00.000Z')
const PRIMARY_PACK = 'utility-energy'

/**
 * Products left deliberately mid-lifecycle in the primary workspace, keyed by their position
 * counted back from the end of the pack. The value is the last stage they clear, so the product
 * sits open on the stage after it with real committed artifacts behind it and nothing ahead.
 */
const IN_PROGRESS_SEEDS = new Map<number, number>([
  [1, 1],
  [2, 6],
])

async function reset() {
  // Order matters: children before parents.
  await prisma.$transaction([
    prisma.agentRunStep.deleteMany(),
    prisma.agentRun.deleteMany(),
    prisma.agentProposal.deleteMany(),
    prisma.agentAction.deleteMany(),
    prisma.agentSetting.deleteMany(),
    prisma.gateEvidence.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.task.deleteMany(),
    prisma.gate.deleteMany(),
    prisma.stageRun.deleteMany(),
    prisma.fieldProvenance.deleteMany(),
    prisma.artifactVersion.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.artifact.deleteMany(),
    prisma.prioritisationOverride.deleteMany(),
    prisma.valueMeasurement.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.accessRequest.deleteMany(),
    prisma.consumptionPatternBinding.deleteMany(),
    prisma.changeRequest.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.externalMetadataImport.deleteMany(),
    prisma.dataProduct.deleteMany(),
    prisma.requestMessage.deleteMany(),
    prisma.productRequest.deleteMany(),
    prisma.maturityAssessment.deleteMany(),
    prisma.roleAssignment.deleteMany(),
    prisma.domain.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.blueprint.deleteMany(),
    prisma.pack.deleteMany(),
    prisma.stage.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

async function seedRolesAndStages() {
  for (const role of ROLES) {
    await prisma.role.create({
      data: {
        id: role.key,
        key: role.key,
        name: role.name,
        door: role.door,
        owns: role.owns,
        description: role.description,
        sortOrder: role.sortOrder,
      },
    })
  }
  for (const stage of STAGES) {
    await prisma.stage.create({
      data: { number: stage.number, key: stage.key, name: stage.name, purpose: stage.purpose },
    })
  }
}

async function seedUsers() {
  const passwordHash = await hash('adpm', 10)
  const byRole = new Map<RoleKey, string>()
  for (const role of ROLES) {
    const user = await prisma.user.create({
      data: {
        email: role.seedEmail,
        name: role.seedName,
        title: role.name,
        passwordHash,
      },
    })
    byRole.set(role.key, user.id)
  }
  // A second consumer, so the marketplace has more than one voice in it.
  const secondConsumer = await prisma.user.create({
    data: {
      email: 'consumer2@adpm.local',
      name: 'Daniel Reyes',
      title: 'Operations Analyst',
      passwordHash,
    },
  })
  return { byRole, secondConsumer }
}

async function installPack(pack: Pack, fileName: string) {
  const row = await prisma.pack.create({
    data: {
      key: pack.key,
      name: pack.name,
      industry: pack.industry,
      version: pack.version,
      sourcePath: `packs/${fileName}`,
      contentJson: JSON.stringify(pack),
      changeLogJson: JSON.stringify([
        { at: NOW.toISOString(), by: 'seed', note: `Installed ${pack.name} v${pack.version}` },
      ]),
    },
  })
  for (const product of pack.seedProducts.filter((p) => p.blueprint)) {
    await prisma.blueprint.create({
      data: {
        packId: row.id,
        key: product.key,
        name: product.name,
        archetype: product.archetype,
        description: product.description,
        contentJson: JSON.stringify(product),
      },
    })
  }
  return row
}

async function seedWorkspace(pack: Pack, users: Map<RoleKey, string>, secondConsumerId: string) {
  const workspace = await prisma.workspace.create({
    data: {
      slug: pack.key,
      name: `${pack.name} Workspace`,
      packKey: pack.key,
      triageSlaHours: 48,
      agentsEnabled: pack.key === PRIMARY_PACK,
      agentsMaySeeSampleData: false,
      agentBudgetUsd: 25,
    },
  })

  const domains = new Map<string, string>()
  for (const domain of pack.domains) {
    const created = await prisma.domain.create({
      data: {
        workspaceId: workspace.id,
        key: domain.key,
        name: domain.name,
        description: domain.description,
      },
    })
    domains.set(domain.key, created.id)
  }

  for (const [roleKey, userId] of users) {
    await prisma.roleAssignment.create({
      data: { userId, roleId: roleKey, workspaceId: workspace.id },
    })
  }
  await prisma.roleAssignment.create({
    data: { userId: secondConsumerId, roleId: 'DATA_CONSUMER', workspaceId: workspace.id },
  })

  for (const agent of AGENTS) {
    await prisma.agentSetting.create({
      data: {
        workspaceId: workspace.id,
        agentId: agent.id,
        autonomyLevel: agent.autonomyCeiling === 'L3' ? 'L3' : 'L1',
        enabled: true,
      },
    })
  }

  return { workspace, domains }
}

/** Drives one seed product from Stage 1 to Stage 12 through the real engine. */
async function seedProduct(params: {
  pack: Pack
  spec: PackSeedProduct
  workspaceId: string
  domainId: string
  domainName: string
  users: Map<RoleKey, string>
  requestId?: string
  /**
   * How far to carry the product. Defaults to the whole lifecycle. A lower number leaves a
   * genuinely in-progress product with real upstream artifacts and an open stage ahead of it —
   * which is what the Lifecycle Studio and the Agent Run Console need in order to show anything
   * at all. A catalogue of 73 finished products has nothing left to demonstrate.
   */
  throughStage?: number
}) {
  const { pack, spec, workspaceId, domainId, users } = params
  const throughStage = params.throughStage ?? STAGES.length
  const completed = throughStage >= STAGES.length
  const ownerId = users.get('DOMAIN_PRODUCT_OWNER')!
  const stewardId = users.get('DATA_STEWARD')!

  const product = await prisma.dataProduct.create({
    data: {
      workspaceId,
      domainId,
      requestId: params.requestId ?? null,
      key: spec.key,
      name: spec.name,
      description: spec.description,
      archetype: spec.archetype,
      tier: spec.tier,
      status: 'IN_PROGRESS',
      currentStage: 1,
      ownerId,
      stewardId,
      blueprintKey: spec.blueprint ? spec.key : null,
      semanticVersion: '1.0.0',
    },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId,
      productId: product.id,
      actorId: ownerId,
      actorType: 'HUMAN',
      action: 'product.created',
      entityType: 'DataProduct',
      entityId: product.id,
      dataJson: JSON.stringify({ from: spec.blueprint ? 'blueprint' : 'request' }),
    },
  })

  const artifacts = buildBlueprintArtifacts(pack, spec, {
    now: NOW,
    ownerName: ROLES.find((r) => r.key === 'DOMAIN_PRODUCT_OWNER')!.seedName,
    stewardName: ROLES.find((r) => r.key === 'DATA_STEWARD')!.seedName,
    domainName: params.domainName,
  })

  for (const stage of STAGES.filter((s) => s.number <= throughStage)) {
    await ensureStageRun(product.id, stage.number)

    for (const artifactType of artifactTypesForStage(stage.number)) {
      let content = artifacts[artifactType.key]
      if (artifactType.key === 'certification-scorecard') {
        const ctx = await buildStageContext(product.id, stage.number)
        content = buildScorecard(ctx.evidenceRefs, ROLES.find((r) => r.key === 'GOVERNANCE_COUNCIL')!.seedName)
      }
      if (content === undefined) continue
      await commitArtifact({
        productId: product.id,
        artifactType: artifactType.key,
        content,
        userId: stewardId,
        message: `Seeded from the ${pack.name} blueprint`,
      })
    }

    const firstApprover = users.get(stage.approverRoles[0]!)!
    await requestTransition({
      productId: product.id,
      stageNumber: stage.number,
      action: 'SUBMIT_FOR_REVIEW',
      userId: stewardId,
      note: 'Seeded submission',
    })
    await requestTransition({
      productId: product.id,
      stageNumber: stage.number,
      action: 'OPEN_GATE',
      userId: firstApprover,
    })

    const gate = await prisma.gate.findFirstOrThrow({
      where: { productId: product.id, stageNumber: stage.number },
      orderBy: { openedAt: 'desc' },
    })

    for (const roleKey of stage.approverRoles) {
      await recordDecision({
        gateId: gate.id,
        userId: users.get(roleKey)!,
        roleKey,
        decision: 'APPROVE',
        rationale: `${getStage(stage.number).name} reviewed against the exit criteria.`,
      })
    }
  }

  if (!completed) {
    // Left mid-flight: the next stage is open, nothing is published, and the exit criteria for
    // that stage genuinely do not pass yet.
    await prisma.dataProduct.update({
      where: { id: product.id },
      data: { currentStage: throughStage + 1, status: 'IN_PROGRESS', semanticVersion: '0.1.0' },
    })
    await ensureStageRun(product.id, throughStage + 1)
    return product
  }

  // Pattern readiness bindings, computed rather than asserted.
  const ctx = await buildStageContext(product.id, 12)
  const committed = new Set(Object.keys(ctx.artifacts))
  for (const pattern of CONSUMPTION_PATTERNS) {
    const readiness = evaluatePatternReadiness(
      pattern,
      committed,
      ctx.approvedStages,
      (type) => getArtifactType(type).stage,
    )
    await prisma.consumptionPatternBinding.create({
      data: {
        productId: product.id,
        patternKey: pattern.key,
        targeted: spec.patterns.includes(pattern.key),
        readinessJson: JSON.stringify(readiness),
      },
    })
  }

  await prisma.valueMeasurement.create({
    data: {
      productId: product.id,
      hypothesisJson: JSON.stringify(spec.value),
      baseline: spec.value.baseline,
      measuredValue: spec.value.realised
        ? (spec.value.measured ?? spec.value.baseline + spec.value.expectedChange)
        : null,
      unit: spec.value.unit,
      state: spec.value.realised ? 'REALISED' : 'NOT_YET_MEASURABLE',
      dueAt: new Date(spec.value.date),
      measuredAt: spec.value.realised ? NOW : null,
      measuredById: spec.value.realised ? ownerId : null,
      note: spec.value.realised ? spec.value.method : 'Measurement date not yet reached.',
    },
  })

  return product
}

async function seedRequestsAndFeedback(params: {
  workspaceId: string
  domainId: string
  users: Map<RoleKey, string>
  consumerId: string
  secondConsumerId: string
  productIds: string[]
}) {
  const { workspaceId, domainId, users, consumerId, secondConsumerId } = params
  const ownerId = users.get('DOMAIN_PRODUCT_OWNER')!

  const submitted = await prisma.productRequest.create({
    data: {
      workspaceId,
      domainId,
      requesterId: consumerId,
      reference: 'REQ-1004',
      title: 'Weekly view of vulnerable customers at risk of disconnection',
      state: 'SUBMITTED',
      decision:
        'Whether to pause collections activity for a customer who may be newly vulnerable but is not yet flagged',
      consumerRole: 'Customer Care Team Leader',
      peopleAffected: 12,
      cadence: 'Weekly',
      currentWorkaround: 'Care agents phone the collections team and check case by case',
      timeTakenToday: 'About 4 hours a week across the team',
      questionsJson: JSON.stringify([
        'Which customers show signs of newly emerging vulnerability?',
        'Which of those are currently in a collections process?',
        'How many were contacted by collections in the last 30 days?',
      ]),
      stakes:
        'A vulnerable customer receives a disconnection notice, which is both a regulatory breach and a serious harm.',
      quantifiedImpact: 'Two reportable incidents last year, each with a regulatory response cost.',
      requiredFreshness: 'Daily',
      preferredPatternKey: 'certified-dashboard',
      sensitivityNotes: 'Involves protected-status and possibly health-related indicators.',
      submittedAt: new Date(NOW.getTime() - 2 * 86_400_000),
      slaDueAt: new Date(NOW.getTime() - 0.5 * 86_400_000),
    },
  })

  const infoRequested = await prisma.productRequest.create({
    data: {
      workspaceId,
      domainId,
      requesterId: secondConsumerId,
      reference: 'REQ-1005',
      title: 'Something to help with meter exchange scheduling',
      state: 'INFO_REQUESTED',
      decision: 'Which meter exchanges to schedule first',
      consumerRole: 'Field Scheduling Coordinator',
      peopleAffected: 5,
      cadence: 'Daily',
      currentWorkaround: 'The scheduler works from a list sorted by install date',
      timeTakenToday: 'An hour a day',
      questionsJson: JSON.stringify([
        'Which meters are overdue for exchange?',
        'Which of those are in areas with a crew visiting this week?',
        'Which exchanges unlock the most billing accuracy?',
      ]),
      stakes: 'Exchanges are scheduled inefficiently and crews travel further than they need to.',
      quantifiedImpact: '',
      requiredFreshness: 'Daily',
      preferredPatternKey: 'operational-activation',
      sensitivityNotes: '',
      submittedAt: new Date(NOW.getTime() - 6 * 86_400_000),
      slaDueAt: new Date(NOW.getTime() - 4 * 86_400_000),
      triagedAt: new Date(NOW.getTime() - 5 * 86_400_000),
      triagedById: ownerId,
    },
  })

  await prisma.requestMessage.create({
    data: {
      requestId: infoRequested.id,
      authorId: ownerId,
      kind: 'INFO_REQUEST',
      body: 'Thanks — before I can triage this, can you quantify the impact? Roughly how many extra kilometres do crews travel a week because of the current scheduling order?',
    },
  })

  await prisma.productRequest.create({
    data: {
      workspaceId,
      domainId,
      requesterId: consumerId,
      reference: 'REQ-1003',
      title: 'A dashboard of everything about customers',
      state: 'DECLINED',
      decision: 'Not stated',
      consumerRole: 'Various',
      peopleAffected: 40,
      cadence: 'Ad hoc',
      currentWorkaround: 'Several existing dashboards',
      timeTakenToday: 'Unknown',
      questionsJson: JSON.stringify([
        'What do we know about customers?',
        'Can we see everything in one place?',
        'Can it be real time?',
      ]),
      stakes: 'Not stated.',
      quantifiedImpact: '',
      requiredFreshness: 'Real time',
      preferredPatternKey: 'certified-dashboard',
      sensitivityNotes: '',
      submittedAt: new Date(NOW.getTime() - 20 * 86_400_000),
      slaDueAt: new Date(NOW.getTime() - 18 * 86_400_000),
      triagedAt: new Date(NOW.getTime() - 19 * 86_400_000),
      triagedById: ownerId,
      declineReason:
        'No decision is named that this would unblock, and the questions are not answerable as stated. Happy to revisit with a specific decision and consumer role.',
    },
  })

  await prisma.task.create({
    data: {
      workspaceId,
      requestId: submitted.id,
      kind: 'TRIAGE',
      title: `Triage ${submitted.reference} — ${submitted.title}`,
      detail: 'Submitted request awaiting triage. The response target has been breached.',
      assigneeRoleKey: 'DOMAIN_PRODUCT_OWNER',
      dueAt: submitted.slaDueAt,
    },
  })

  for (const productId of params.productIds.slice(0, 2)) {
    await prisma.feedback.create({
      data: {
        productId,
        userId: consumerId,
        rating: 5,
        comment: 'This replaced a weekly spreadsheet that three of us maintained.',
        sentiment: 'POSITIVE',
      },
    })
    await prisma.accessRequest.create({
      data: {
        productId,
        requesterId: secondConsumerId,
        patternKey: 'certified-dashboard',
        purpose: 'Operational reporting for the regional team',
        state: 'PENDING',
      },
    })
  }

  const lastProductId = params.productIds[params.productIds.length - 1]
  if (lastProductId) {
    await prisma.changeRequest.create({
      data: {
        productId: lastProductId,
        raisedByAgentId: 'steward',
        title: 'Freshness breaches exceed the contract commitment',
        detail:
          'Three freshness breaches in the last 30 days against a daily commitment. Either the pipeline schedule or the contract SLA has to change.',
        severity: 'HIGH',
        versionBump: 'MINOR',
        affectedStages: '5,8',
        state: 'OPEN',
      },
    })
  }
}

async function seedMaturity(workspaceId: string, createdById: string) {
  await prisma.maturityAssessment.create({
    data: {
      workspaceId,
      createdById,
      scoresJson: JSON.stringify({
        'consumption-orientation': 3,
        'lifecycle-discipline': 3,
        'semantic-consistency': 2,
        'governance-trust': 3,
        'platform-automation': 2,
        'operating-model-adoption': 2,
      }),
      notesJson: JSON.stringify({
        'semantic-consistency':
          'Metrics are defined per product rather than per workspace; two definitions of arrears are still in use downstream.',
      }),
    },
  })
}

async function main() {
  console.log('Resetting…')
  await reset()

  console.log('Seeding roles, stages and users…')
  await seedRolesAndStages()
  const { byRole, secondConsumer } = await seedUsers()

  const packs = await loadAllPacks()
  const primary = packs.find(({ pack }) => pack.key === PRIMARY_PACK)
  if (!primary) throw new Error(`Primary pack ${PRIMARY_PACK} not found`)

  for (const { fileName, pack } of packs) {
    console.log(`\nPack ${pack.name}`)
    await installPack(pack, fileName)
    const { workspace, domains } = await seedWorkspace(pack, byRole, secondConsumer.id)

    const productIds: string[] = []
    for (const [index, spec] of pack.seedProducts.entries()) {
      const domainId = domains.get(spec.domainKey)!
      const domainName = pack.domains.find((d) => d.key === spec.domainKey)!.name
      // A marketplace of nothing but finished products has nothing left to demonstrate, so the
      // primary pack keeps its last two mid-flight: one at the very start, one halfway. They are
      // what the Lifecycle Studio and the Agent Run Console actually have work to do on.
      const throughStage = IN_PROGRESS_SEEDS.get(
        pack.key === PRIMARY_PACK ? pack.seedProducts.length - index : -1,
      )
      process.stdout.write(`  · ${spec.name} `)
      const product = await seedProduct({
        pack,
        spec,
        workspaceId: workspace.id,
        domainId,
        domainName,
        users: byRole,
        throughStage,
      })
      if (throughStage === undefined) {
        productIds.push(product.id)
        console.log('→ published')
      } else {
        console.log(`→ in progress at Stage ${throughStage + 1}`)
      }
    }

    if (pack.key === PRIMARY_PACK) {
      await seedRequestsAndFeedback({
        workspaceId: workspace.id,
        domainId: domains.get(pack.domains[0]!.key)!,
        users: byRole,
        consumerId: byRole.get('DATA_CONSUMER')!,
        secondConsumerId: secondConsumer.id,
        productIds,
      })
      await seedMaturity(workspace.id, byRole.get('PORTFOLIO_LEAD')!)
    }
  }

  const counts = {
    workspaces: await prisma.workspace.count(),
    products: await prisma.dataProduct.count(),
    published: await prisma.dataProduct.count({ where: { status: 'PUBLISHED' } }),
    gatesApproved: await prisma.gate.count({ where: { state: 'APPROVED' } }),
    artifactVersions: await prisma.artifactVersion.count(),
    auditEvents: await prisma.auditEvent.count(),
    requests: await prisma.productRequest.count(),
  }
  console.log('\nSeed complete:', counts)
  console.log('\nSign in with any seeded email and the password "adpm", e.g. owner@adpm.local')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
