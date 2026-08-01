import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { marketplaceDetail } from '@/lib/queries/marketplace'
import { requireSession } from '@/lib/auth/session'
import { CONSUMPTION_PATTERNS, patternName } from '@/lib/patterns/registry'
import { DATSIS_LABELS, type DatsisDimension } from '@/lib/domain/enums'
import { ActionForm } from '@/components/forms'
import { requestAccess, submitFeedback } from '../actions'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataList,
  Field,
  LinkButton,
  PageHeader,
  inputClass,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProductListingPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const detail = await marketplaceDetail(key)
  if (!detail) notFound()
  const session = await requireSession()

  const bindings = await prisma.consumptionPatternBinding.findMany({
    where: { productId: detail.entry.productId },
  })
  const readiness = new Map(
    bindings.map((b) => [b.patternKey, JSON.parse(b.readinessJson) as { readiness: string; blockedReason: string }]),
  )

  const myAccess = await prisma.accessRequest.findFirst({
    where: { productId: detail.entry.productId, requesterId: session.userId },
    orderBy: { createdAt: 'desc' },
  })

  const approvedGates = detail.approvals.filter((g) => g.state === 'APPROVED').length
  const staleGates = detail.approvals.filter((g) => g.state === 'STALE')

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/marketplace" className="text-accent-600 underline">
          ← Marketplace
        </Link>
      </p>
      <PageHeader
        eyebrow={`${detail.entry.industry} · ${detail.entry.domainName}`}
        title={detail.entry.name}
        description={detail.entry.listing.description}
        actions={
          <LinkButton href={`/products/${detail.entry.productId}`}>Open in Lifecycle Studio</LinkButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Questions this product answers"
              description="Taken from the Stage 1 decision register — questions a named consumer actually asked."
            />
            <CardBody>
              {detail.questions.length === 0 ? (
                <p className="text-sm text-ink-600">No decision register is committed.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
                  {detail.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Certified metrics"
              description="One metric, one definition, one answer — in every channel."
            />
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-2">Metric</th>
                    <th className="px-3 py-2">Definition</th>
                    <th className="px-5 py-2">Grain</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.metrics.map((metric) => (
                    <tr key={metric.name} className="border-t border-ink-100">
                      <td className="px-5 py-2 font-mono text-xs text-ink-900">{metric.name}</td>
                      <td className="px-3 py-2 text-ink-700">{metric.definition}</td>
                      <td className="px-5 py-2 text-xs text-ink-600">{metric.grain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Supported consumption patterns"
              description="Green where every required artifact exists and its stage is approved."
            />
            <CardBody>
              <ul className="grid gap-2 sm:grid-cols-2">
                {CONSUMPTION_PATTERNS.map((pattern) => {
                  const state = readiness.get(pattern.key)
                  const supported = detail.entry.listing.supportedPatterns.includes(pattern.key)
                  const tone =
                    state?.readiness === 'READY' ? 'good' : state?.readiness === 'DRAFTED' ? 'warn' : 'bad'
                  return (
                    <li key={pattern.key} className="flex items-start justify-between gap-2 rounded-md border border-ink-200 px-3 py-2">
                      <div>
                        <p className="text-sm text-ink-800">{pattern.name}</p>
                        {state && state.readiness !== 'READY' ? (
                          <p className="text-xs text-ink-500">{state.blockedReason}</p>
                        ) : null}
                      </div>
                      <Badge tone={supported ? tone : 'neutral'}>
                        {supported ? (state?.readiness ?? 'UNKNOWN') : 'not offered'}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sample queries and lineage" />
            <CardBody>
              <p className="text-sm text-ink-700">{detail.entry.listing.lineageSummary}</p>
              <ul className="mt-3 space-y-1">
                {detail.entry.listing.sampleQueries.map((query) => (
                  <li key={query} className="rounded bg-ink-50 px-3 py-1.5 font-mono text-xs text-ink-800">
                    {query}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {detail.similar.length > 0 ? (
            <Card>
              <CardHeader
                title="Products like this"
                description="Computed from shared entities, not from tags someone typed."
              />
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {detail.similar.map((similar) => (
                    <li key={similar.productId} className="flex justify-between gap-3">
                      <Link href={`/products/${similar.productId}`} className="text-accent-600 underline">
                        {similar.name}
                      </Link>
                      <span className="text-xs text-ink-500">shares {similar.shared.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Trust signals" />
            <CardBody>
              <DataList
                rows={[
                  { label: 'Owner', value: detail.entry.listing.owner },
                  { label: 'Steward', value: detail.entry.listing.steward },
                  { label: 'Freshness', value: detail.entry.listing.freshness },
                  { label: 'Quality score', value: `${detail.entry.listing.qualityScore}/100` },
                  { label: 'Access tier', value: detail.entry.listing.accessTier },
                  {
                    label: 'Cost to serve',
                    value: `$${detail.entry.listing.costToServeUsdPerMonth.toLocaleString()} / month`,
                  },
                  { label: 'Gates approved', value: `${approvedGates} of 12` },
                  {
                    label: 'Contract SLA',
                    value: detail.contract
                      ? `${detail.contract.freshnessMinutes} min freshness, ${detail.contract.availabilityPct}% availability`
                      : 'No contract committed',
                  },
                  {
                    label: 'Consumers (30d)',
                    value: detail.telemetry ? `${detail.telemetry.consumers}` : 'No telemetry',
                  },
                ]}
              />
              {staleGates.length > 0 ? (
                <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {staleGates.length} approval(s) went stale after an artifact changed. Re-approval is
                  outstanding — this is shown deliberately rather than hidden.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {detail.scorecard ? (
            <Card>
              <CardHeader title="DATSIS+V" description="Each dimension scored against cited evidence." />
              <CardBody>
                <ul className="space-y-1.5 text-sm">
                  {detail.scorecard.map((dimension) => (
                    <li key={dimension.dimension} className="flex items-center justify-between gap-2">
                      <span className="text-ink-700">
                        {DATSIS_LABELS[dimension.dimension as DatsisDimension] ?? dimension.dimension}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={dimension.citations > 0 ? 'good' : 'bad'}>
                          {dimension.citations} citation{dimension.citations === 1 ? '' : 's'}
                        </Badge>
                        <span className="font-mono text-xs">{dimension.score}/5</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Request access" />
            <CardBody>
              {myAccess ? (
                <p className="mb-3 text-sm text-ink-700">
                  Your last request is <strong>{myAccess.state}</strong>
                  {myAccess.decisionNote ? ` — ${myAccess.decisionNote}` : ''}.
                </p>
              ) : null}
              <ActionForm action={requestAccess} submitLabel="Request access">
                <input type="hidden" name="productId" value={detail.entry.productId} />
                <Field label="How will you consume it?" htmlFor="patternKey" required>
                  <select id="patternKey" name="patternKey" className={inputClass} required>
                    {detail.entry.listing.supportedPatterns.map((patternKey) => (
                      <option key={patternKey} value={patternKey}>
                        {patternName(patternKey)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Purpose"
                  htmlFor="purpose"
                  hint="Access is granted per purpose, not per person."
                  required
                >
                  <textarea id="purpose" name="purpose" rows={3} className={inputClass} required />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rate this product" />
            <CardBody>
              <ActionForm action={submitFeedback} submitLabel="Submit feedback" variant="secondary">
                <input type="hidden" name="productId" value={detail.entry.productId} />
                <Field label="Rating (1–5)" htmlFor="rating" required>
                  <input id="rating" name="rating" type="number" min={1} max={5} defaultValue={5} className={inputClass} required />
                </Field>
                <Field label="Comment" htmlFor="comment">
                  <textarea id="comment" name="comment" rows={2} className={inputClass} />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
