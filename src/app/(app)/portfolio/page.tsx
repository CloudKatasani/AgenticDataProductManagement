import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { dependencyGraph, portfolioRows, programmeKpis } from '@/lib/queries/portfolio'
import { MATURITY_DIMENSIONS, maturityLevelLabel, overallMaturity } from '@/lib/portfolio/maturity'
import { Mermaid } from '@/components/mermaid'
import { MaturityForm, PrioritisationOverrideForm } from './panels'
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}

export default async function PortfolioPage() {
  const session = await requireSession()
  const rows = await portfolioRows(session.workspaceId)
  const kpis = await programmeKpis(session.workspaceId, rows)
  const assessment = await prisma.maturityAssessment.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true },
  })
  const scores = assessment ? (JSON.parse(assessment.scoresJson) as Record<string, number>) : {}
  const notes = assessment ? (JSON.parse(assessment.notesJson) as Record<string, string>) : {}

  const canOverride =
    session.roles.includes('PORTFOLIO_LEAD') || session.roles.includes('DOMAIN_PRODUCT_OWNER')

  const ranked = [...rows].sort(
    (a, b) => (b.overrideScore ?? b.score.score) - (a.overrideScore ?? a.score.score),
  )
  const stalled = rows.filter((r) => r.status === 'PUBLISHED' && (r.daysSinceLastUse ?? 0) >= 90)

  return (
    <div>
      <PageHeader
        eyebrow="Lead"
        title="Portfolio"
        description={`What we are building in ${session.workspaceName}, in what order, at what cost, and what it returned.`}
        actions={<LinkButton href="/api/export/portfolio">Export to Excel</LinkButton>}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Programme KPIs
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Request to triage"
            value={kpis.requestToTriageHours === null ? '—' : `${kpis.requestToTriageHours} h`}
            hint={kpis.slaAdherencePct === null ? undefined : `${kpis.slaAdherencePct}% within target`}
          />
          <Kpi
            label="Gate cycle time"
            value={kpis.gateCycleTimeDays === null ? '—' : `${kpis.gateCycleTimeDays} d`}
            hint={`${kpis.reworkLoops} rework loop(s) across the portfolio`}
          />
          <Kpi
            label="First-time certification"
            value={
              kpis.firstTimeCertificationPassRate === null ? '—' : `${kpis.firstTimeCertificationPassRate}%`
            }
          />
          <Kpi label="Reuse ratio" value={`${kpis.reuseRatio}%`} hint="Shared metric definitions" />
          <Kpi label="Adoption per product" value={`${kpis.adoptionPerProduct}`} hint="Mean consumers" />
          <Kpi label="Cost per product" value={`$${kpis.costPerProductUsd.toLocaleString()}`} hint="Run + serve + agent spend, per year" />
          <Kpi
            label="Agent acceptance"
            value={kpis.agentAcceptanceRate === null ? 'no runs yet' : `${kpis.agentAcceptanceRate}%`}
            hint="Proposals accepted or edited"
          />
          <Kpi
            label="Value realisation"
            value={`${kpis.valueRealisationRate}%`}
            hint={`${kpis.zeroConsumption90d} product(s) with zero consumption for 90 days`}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Pipeline"
              description="Every product, where it is, and what it cost. Nothing is hidden because it is inconvenient."
            />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-2">Product</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Gates</th>
                    <th className="px-3 py-2">Consumers</th>
                    <th className="px-3 py-2">Cost / yr</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-5 py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.id} className="border-t border-ink-100">
                      <td className="px-5 py-2">
                        <Link href={`/products/${row.id}`} className="font-medium text-accent-600 hover:underline">
                          {row.name}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {row.domainName} · {row.ownerName}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-600">
                        {row.currentStage} — {row.stageName}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.approvedGates}/12
                        {row.staleGates > 0 ? (
                          <Badge tone="warn">{row.staleGates} stale</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.consumers}
                        {(row.daysSinceLastUse ?? 0) >= 90 ? (
                          <Badge tone="bad" title="No consumption for 90 days">
                            dormant
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        ${(row.runCostPerYearUsd + row.costToServeUsdPerMonth * 12).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Badge
                          tone={
                            row.valueState === 'REALISED'
                              ? 'good'
                              : row.valueState === 'NOT_REALISED'
                                ? 'bad'
                                : 'warn'
                          }
                        >
                          {row.valueState.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-5 py-2 text-xs" title={row.score.explanation}>
                        <span className={row.overrideScore !== null ? 'line-through text-ink-400' : ''}>
                          {row.score.score}
                        </span>
                        {row.overrideScore !== null ? (
                          <span className="ml-1 font-semibold text-ink-900">{row.overrideScore}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Dependency and reuse graph"
              description="Computed from committed artifacts — which products share which entities."
            />
            <CardBody>
              <Mermaid chart={dependencyGraph(rows)} title="Product and entity dependency graph" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Capability maturity"
              description="Five levels across six dimensions. This is the artifact a client engagement opens with."
              actions={<LinkButton href="/api/export/maturity">Export to Word</LinkButton>}
            />
            <CardBody>
              {assessment ? (
                <p className="mb-4 text-sm text-ink-700">
                  Last assessed {assessment.createdAt.toLocaleDateString('en-GB')} by{' '}
                  {assessment.createdBy.name} · overall {overallMaturity(scores)} (
                  {maturityLevelLabel(Math.round(overallMaturity(scores)))})
                </p>
              ) : (
                <p className="mb-4 text-sm text-ink-600">No assessment recorded yet.</p>
              )}
              <ul className="mb-6 space-y-3">
                {MATURITY_DIMENSIONS.map((dimension) => {
                  const level = scores[dimension.key] ?? 0
                  return (
                    <li key={dimension.key}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-ink-900">{dimension.name}</span>
                        <span className="text-xs text-ink-600">
                          Level {level} — {maturityLevelLabel(level)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded bg-ink-100" role="img" aria-label={`Level ${level} of 5`}>
                        <div
                          className="h-2 rounded bg-accent-500"
                          style={{ width: `${(level / 5) * 100}%` }}
                        />
                      </div>
                      {notes[dimension.key] ? (
                        <p className="mt-1 text-xs text-ink-600">{notes[dimension.key]}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-500">
                        Next: {dimension.nextMoves[Math.min(level, 2)]}
                      </p>
                    </li>
                  )
                })}
              </ul>
              <MaturityForm scores={scores} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Prioritisation"
              description="WSJF adapted with a reuse multiplier. Advisory, and always overridable with a recorded reason."
            />
            <CardBody>
              <ol className="space-y-2 text-sm">
                {ranked.slice(0, 8).map((row, index) => (
                  <li key={row.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="mr-2 text-ink-400">{index + 1}.</span>
                      <Link href={`/products/${row.id}`} className="text-accent-600 hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-xs text-ink-500">{row.score.explanation}</p>
                      {row.overrideReason ? (
                        <p className="text-xs italic text-amber-700">Override: {row.overrideReason}</p>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs">{row.overrideScore ?? row.score.score}</span>
                  </li>
                ))}
              </ol>
              {canOverride ? (
                <div className="mt-4 border-t border-ink-200 pt-4">
                  <PrioritisationOverrideForm products={rows.map((r) => ({ id: r.id, name: r.name }))} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Adoption"
              description="The honest metric most catalogues refuse to show."
            />
            <CardBody>
              {stalled.length === 0 ? (
                <p className="text-sm text-ink-600">
                  No published product has been unused for 90 days.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stalled.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2">
                      <Link href={`/products/${row.id}`} className="text-accent-600 hover:underline">
                        {row.name}
                      </Link>
                      <Badge tone="bad">{row.daysSinceLastUse} days idle</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Value realisation" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-700">{row.name}</span>
                    <span className="text-xs">
                      {row.valueMeasured !== null
                        ? `${row.valueMeasured} vs ${row.valueBaseline} ${row.valueUnit}`
                        : row.valueDueAt
                          ? `due ${row.valueDueAt.toLocaleDateString('en-GB')}`
                          : 'no hypothesis'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
