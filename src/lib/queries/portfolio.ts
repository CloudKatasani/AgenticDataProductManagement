import { prisma } from '@/lib/db'
import {
  attributeRegisterSchema,
  semanticModelSchema,
  servingSpecSchema,
  telemetrySchema,
  valueCaseSchema,
} from '@/lib/artifacts/registry'
import { deriveInputs, wsjfWithReuse, type ScoreResult } from '@/lib/portfolio/scoring'
import { getStage } from '@/lib/lifecycle/stages'

export interface PortfolioRow {
  id: string
  key: string
  name: string
  status: string
  currentStage: number
  stageName: string
  domainName: string
  ownerName: string
  approvedGates: number
  staleGates: number
  createdAt: Date
  publishedAt: Date | null
  buildEffortDays: number
  runCostPerYearUsd: number
  costToServeUsdPerMonth: number
  agentSpendUsd: number
  consumers: number
  queries30d: number
  daysSinceLastUse: number | null
  patternsCovered: number
  score: ScoreResult
  overrideScore: number | null
  overrideReason: string | null
  valueState: string
  valueBaseline: number | null
  valueMeasured: number | null
  valueUnit: string
  valueDueAt: Date | null
  entities: string[]
  metrics: string[]
  cycleTimeDays: number | null
  reworkLoops: number
}

async function contentOf(productId: string, type: string): Promise<unknown | undefined> {
  const artifact = await prisma.artifact.findUnique({
    where: { productId_type: { productId, type } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  const version = artifact?.versions[0]
  return version ? (JSON.parse(version.contentJson) as unknown) : undefined
}

export async function portfolioRows(workspaceId: string): Promise<PortfolioRow[]> {
  const products = await prisma.dataProduct.findMany({
    where: { workspaceId, archivedAt: null },
    include: {
      owner: true,
      domain: true,
      request: true,
      gates: true,
      stageRuns: true,
      valueMeasurements: { orderBy: { createdAt: 'desc' }, take: 1 },
      patternBindings: true,
      prioritisation: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })

  const agentSpend = await prisma.agentAction.groupBy({
    by: ['productId'],
    _sum: { estimatedCostUsd: true },
    where: { workspaceId },
  })
  const spendByProduct = new Map(
    agentSpend.map((row) => [row.productId ?? '', row._sum.estimatedCostUsd ?? 0]),
  )

  const rows: PortfolioRow[] = []
  for (const product of products) {
    const valueCase = valueCaseSchema.safeParse(await contentOf(product.id, 'value-case'))
    const serving = servingSpecSchema.safeParse(await contentOf(product.id, 'serving-spec'))
    const telemetry = telemetrySchema.safeParse(await contentOf(product.id, 'telemetry'))
    const register = attributeRegisterSchema.safeParse(await contentOf(product.id, 'attribute-register'))
    const semantic = semanticModelSchema.safeParse(await contentOf(product.id, 'semantic-model'))

    const sensitive = register.success
      ? register.data.attributes.filter((a) => a.pii || a.sensitivity === 'RESTRICTED').length
      : 0
    const buildEffortDays = valueCase.success ? valueCase.data.buildEffortDays : 20

    const score = wsjfWithReuse(
      deriveInputs({
        peopleAffected: product.request?.peopleAffected ?? 10,
        cadence: product.request?.cadence ?? 'weekly',
        sensitiveAttributes: sensitive,
        buildEffortDays,
        backboneBindings: 1,
        reusedMetrics: 0,
        totalMetrics: semantic.success ? semantic.data.metrics.length : 0,
      }),
    )

    const lastUsed = telemetry.success && telemetry.data.lastUsedAt ? Date.parse(telemetry.data.lastUsedAt) : NaN
    const measurement = product.valueMeasurements[0]
    const approvedGates = product.gates.filter((g) => g.state === 'APPROVED')
    const firstRun = product.stageRuns.reduce<Date | null>(
      (earliest, run) => (!earliest || run.openedAt < earliest ? run.openedAt : earliest),
      null,
    )
    const lastApproval = approvedGates.reduce<Date | null>(
      (latest, gate) => (gate.decidedAt && (!latest || gate.decidedAt > latest) ? gate.decidedAt : latest),
      null,
    )

    rows.push({
      id: product.id,
      key: product.key,
      name: product.name,
      status: product.status,
      currentStage: product.currentStage,
      stageName: getStage(product.currentStage).name,
      domainName: product.domain.name,
      ownerName: product.owner.name,
      approvedGates: approvedGates.length,
      staleGates: product.gates.filter((g) => g.state === 'STALE').length,
      createdAt: product.createdAt,
      publishedAt: product.publishedAt,
      buildEffortDays,
      runCostPerYearUsd: valueCase.success ? valueCase.data.runCostPerYearUsd : 0,
      costToServeUsdPerMonth: serving.success ? serving.data.costToServeUsdPerMonth : 0,
      agentSpendUsd: spendByProduct.get(product.id) ?? 0,
      consumers: telemetry.success ? telemetry.data.consumers : 0,
      queries30d: telemetry.success ? telemetry.data.queries30d : 0,
      daysSinceLastUse: Number.isNaN(lastUsed)
        ? null
        : Math.floor((Date.now() - lastUsed) / 86_400_000),
      patternsCovered: product.patternBindings.filter((binding) => {
        const readiness = JSON.parse(binding.readinessJson) as { readiness?: string }
        return binding.targeted && readiness.readiness === 'READY'
      }).length,
      score,
      overrideScore: product.prioritisation[0]?.score ?? null,
      overrideReason: product.prioritisation[0]?.reason ?? null,
      valueState: measurement?.state ?? 'NOT_YET_MEASURABLE',
      valueBaseline: measurement?.baseline ?? null,
      valueMeasured: measurement?.measuredValue ?? null,
      valueUnit: measurement?.unit ?? '',
      valueDueAt: measurement?.dueAt ?? null,
      entities: register.success ? [...new Set(register.data.attributes.map((a) => a.entity))] : [],
      metrics: semantic.success ? semantic.data.metrics.map((m) => m.name) : [],
      cycleTimeDays:
        firstRun && lastApproval
          ? Math.max(0, Math.round((lastApproval.getTime() - firstRun.getTime()) / 86_400_000))
          : null,
      reworkLoops: product.stageRuns.reduce((sum, run) => sum + (run.attempt - 1), 0),
    })
  }
  return rows
}

/** Mermaid dependency graph computed from shared entities and metrics. */
export function dependencyGraph(rows: PortfolioRow[]): string {
  const lines = ['graph LR']
  const entityNodes = new Set<string>()
  for (const row of rows) {
    lines.push(`  P_${row.key.replace(/[^a-zA-Z0-9]/g, '_')}["${row.name}"]`)
    for (const entity of row.entities) {
      const nodeId = `E_${entity.replace(/[^a-zA-Z0-9]/g, '_')}`
      if (!entityNodes.has(nodeId)) {
        entityNodes.add(nodeId)
        lines.push(`  ${nodeId}(("${entity}"))`)
      }
      lines.push(`  P_${row.key.replace(/[^a-zA-Z0-9]/g, '_')} --> ${nodeId}`)
    }
  }
  if (rows.length === 0) lines.push('  none["No products yet"]')
  return lines.join('\n')
}

export interface ProgrammeKpis {
  requestToTriageHours: number | null
  gateCycleTimeDays: number | null
  reworkLoops: number
  firstTimeCertificationPassRate: number | null
  reuseRatio: number
  adoptionPerProduct: number
  slaAdherencePct: number | null
  costPerProductUsd: number
  agentAcceptanceRate: number | null
  valueRealisationRate: number
  zeroConsumption90d: number
}

export async function programmeKpis(workspaceId: string, rows: PortfolioRow[]): Promise<ProgrammeKpis> {
  const requests = await prisma.productRequest.findMany({ where: { workspaceId } })
  const triaged = requests.filter((r) => r.submittedAt && r.triagedAt)
  const requestToTriageHours = triaged.length
    ? triaged.reduce((sum, r) => sum + (r.triagedAt!.getTime() - r.submittedAt!.getTime()), 0) /
      triaged.length /
      3_600_000
    : null
  const withinSla = requests.filter((r) => r.slaDueAt && r.triagedAt && r.triagedAt <= r.slaDueAt).length

  const cycleTimes = rows.map((r) => r.cycleTimeDays).filter((v): v is number => v !== null)
  const reworkLoops = rows.reduce((sum, r) => sum + r.reworkLoops, 0)
  const certified = rows.filter((r) => r.approvedGates >= 11)
  const firstTimePass = certified.filter((r) => r.reworkLoops === 0).length

  const allMetrics = rows.flatMap((r) => r.metrics)
  const uniqueMetrics = new Set(allMetrics)
  const reuseRatio = allMetrics.length === 0 ? 0 : 1 - uniqueMetrics.size / allMetrics.length

  const proposals = await prisma.agentProposal.findMany({
    where: { product: { workspaceId } },
    select: { state: true },
  })
  const dispositioned = proposals.filter((p) => p.state !== 'PENDING')
  const accepted = proposals.filter((p) => p.state === 'ACCEPTED' || p.state === 'EDITED')

  const measurable = rows.filter((r) => r.valueState !== 'NOT_YET_MEASURABLE')
  const realised = rows.filter((r) => r.valueState === 'REALISED')

  return {
    requestToTriageHours: requestToTriageHours === null ? null : Number(requestToTriageHours.toFixed(1)),
    gateCycleTimeDays: cycleTimes.length
      ? Number((cycleTimes.reduce((sum, v) => sum + v, 0) / cycleTimes.length).toFixed(1))
      : null,
    reworkLoops,
    firstTimeCertificationPassRate: certified.length
      ? Number(((firstTimePass / certified.length) * 100).toFixed(0))
      : null,
    reuseRatio: Number((reuseRatio * 100).toFixed(0)),
    adoptionPerProduct: rows.length
      ? Number((rows.reduce((sum, r) => sum + r.consumers, 0) / rows.length).toFixed(1))
      : 0,
    slaAdherencePct: triaged.length ? Number(((withinSla / triaged.length) * 100).toFixed(0)) : null,
    costPerProductUsd: rows.length
      ? Number(
          (
            rows.reduce((sum, r) => sum + r.runCostPerYearUsd + r.costToServeUsdPerMonth * 12 + r.agentSpendUsd, 0) /
            rows.length
          ).toFixed(0),
        )
      : 0,
    agentAcceptanceRate: dispositioned.length
      ? Number(((accepted.length / dispositioned.length) * 100).toFixed(0))
      : null,
    valueRealisationRate: measurable.length
      ? Number(((realised.length / measurable.length) * 100).toFixed(0))
      : 0,
    zeroConsumption90d: rows.filter(
      (r) => r.status === 'PUBLISHED' && (r.daysSinceLastUse ?? 0) >= 90,
    ).length,
  }
}
