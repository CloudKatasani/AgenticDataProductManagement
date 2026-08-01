import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { loadProductOverview } from '@/lib/queries/studio'
import { patternName } from '@/lib/patterns/registry'
import { StageNav } from '@/components/studio/stage-nav'
import { ChangeRequestPanel, ValuePanel } from '@/components/studio/operate'
import { dispositionChangeRequestAction } from '../actions'
import { Badge, Button, Card, CardBody, CardHeader, DataList, LinkButton, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProductOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const overview = await loadProductOverview(id)
  if (!overview) notFound()
  const { product, artifactSummary } = overview

  const gateStates = new Map(product.gates.map((g) => [g.stageNumber, g.state]))
  const value = product.valueMeasurements[0]
  const audit = await prisma.auditEvent.count({ where: { productId: id } })

  return (
    <div>
      <PageHeader
        eyebrow={`${product.workspace.name} · ${product.domain.name}`}
        title={product.name}
        description={product.description}
        actions={
          <span className="flex flex-wrap gap-2">
            <LinkButton href={`/products/${id}/stage/${product.currentStage}`} variant="primary">
              Open Stage {product.currentStage}
            </LinkButton>
            <LinkButton href={`/api/export/evidence-pack/${id}`}>Evidence pack (Word)</LinkButton>
            <LinkButton href={`/api/export/attributes/${id}`}>Attributes (Excel)</LinkButton>
          </span>
        }
      />

      <StageNav productId={id} current={product.currentStage} gateStates={gateStates} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Committed artifacts" description="Every version is content-hashed and immutable." />
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-2">Artifact</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-5 py-2">Committed</th>
                  </tr>
                </thead>
                <tbody>
                  {artifactSummary.map((artifact) => (
                    <tr key={artifact.type} className="border-t border-ink-100">
                      <td className="px-5 py-2">
                        <Link
                          href={`/products/${id}/stage/${artifact.stage}`}
                          className="text-accent-600 hover:underline"
                        >
                          {artifact.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-ink-600">{artifact.stage}</td>
                      <td className="px-3 py-2 font-mono text-xs">v{artifact.version}</td>
                      <td className="px-5 py-2 text-xs text-ink-500">
                        {artifact.committedAt?.toLocaleString('en-GB') ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <ChangeRequestPanel productId={id} />

          <Card>
            <CardHeader title="Open change requests" />
            <CardBody>
              {product.changeRequests.length === 0 ? (
                <p className="text-sm text-ink-600">No change requests.</p>
              ) : (
                <ul className="space-y-3">
                  {product.changeRequests.map((cr) => (
                    <li key={cr.id} className="rounded-md border border-ink-200 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={cr.state === 'OPEN' ? 'warn' : cr.state === 'REJECTED' ? 'bad' : 'good'}>
                          {cr.state}
                        </Badge>
                        <Badge>{cr.severity}</Badge>
                        <Badge tone="info">{cr.versionBump}</Badge>
                        <span className="text-sm font-medium text-ink-900">{cr.title}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink-700">{cr.detail}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        Raised by {cr.raisedBy?.name ?? `${cr.raisedByAgentId} agent`} ·{' '}
                        {cr.createdAt.toLocaleDateString('en-GB')}
                      </p>
                      {cr.state === 'OPEN' &&
                      (session.roles.includes('DOMAIN_PRODUCT_OWNER') ||
                        session.roles.includes('GOVERNANCE_COUNCIL')) ? (
                        <form action={dispositionChangeRequestAction} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="changeRequestId" value={cr.id} />
                          <input
                            name="note"
                            placeholder="Disposition note"
                            className="flex-1 rounded-md border border-ink-300 px-2 py-1 text-sm"
                          />
                          <Button name="state" value="ACCEPTED" variant="primary">
                            Accept &amp; bump version
                          </Button>
                          <Button name="state" value="REJECTED" variant="danger">
                            Reject
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="At a glance" />
            <CardBody>
              <DataList
                rows={[
                  { label: 'Status', value: product.status },
                  { label: 'Semantic version', value: product.semanticVersion },
                  { label: 'Owner', value: product.owner.name },
                  { label: 'Steward', value: product.steward?.name ?? 'Unassigned' },
                  { label: 'Archetype', value: product.archetype },
                  { label: 'Tier', value: product.tier },
                  {
                    label: 'From request',
                    value: product.request ? (
                      <Link href={`/request/${product.request.id}`} className="text-accent-600 underline">
                        {product.request.reference}
                      </Link>
                    ) : (
                      'Seeded from a blueprint'
                    ),
                  },
                  { label: 'Audit events', value: audit },
                  {
                    label: 'Published',
                    value: product.publishedAt?.toLocaleDateString('en-GB') ?? 'Not published',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <ValuePanel
            productId={id}
            value={
              value
                ? {
                    baseline: value.baseline,
                    measuredValue: value.measuredValue,
                    unit: value.unit,
                    state: value.state,
                    dueAt: value.dueAt?.toISOString() ?? null,
                    note: value.note,
                  }
                : undefined
            }
            canMeasure={
              session.roles.includes('DOMAIN_PRODUCT_OWNER') || session.roles.includes('PORTFOLIO_LEAD')
            }
          />

          <Card>
            <CardHeader title="Consumption readiness" />
            <CardBody>
              <ul className="space-y-1 text-sm">
                {product.patternBindings.map((binding) => {
                  const readiness = JSON.parse(binding.readinessJson) as { readiness: string }
                  return (
                    <li key={binding.id} className="flex items-center justify-between gap-2">
                      <span className="text-ink-700">{patternName(binding.patternKey)}</span>
                      <Badge
                        tone={
                          !binding.targeted
                            ? 'neutral'
                            : readiness.readiness === 'READY'
                              ? 'good'
                              : readiness.readiness === 'DRAFTED'
                                ? 'warn'
                                : 'bad'
                        }
                      >
                        {binding.targeted ? readiness.readiness : 'not targeted'}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Access requests" />
            <CardBody>
              {product.accessRequests.length === 0 ? (
                <p className="text-sm text-ink-600">None.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {product.accessRequests.map((request) => (
                    <li key={request.id} className="flex items-center justify-between gap-2">
                      <span className="text-ink-700">
                        {request.requester.name} · {patternName(request.patternKey)}
                      </span>
                      <Badge tone={request.state === 'PENDING' ? 'warn' : request.state === 'APPROVED' ? 'good' : 'bad'}>
                        {request.state}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
