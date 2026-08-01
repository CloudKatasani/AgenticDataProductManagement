import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { CONSUMPTION_PATTERNS } from '@/lib/patterns/registry'
import { artifactTitle } from '@/lib/artifacts/registry'
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const session = await requireSession()
  const { product: selectedId } = await searchParams

  const products = await prisma.dataProduct.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  const selected = selectedId ?? products[0]?.id
  const bindings = selected
    ? await prisma.consumptionPatternBinding.findMany({ where: { productId: selected } })
    : []
  const readiness = new Map(
    bindings.map((b) => [
      b.patternKey,
      {
        targeted: b.targeted,
        ...(JSON.parse(b.readinessJson) as {
          readiness: string
          blockedReason: string
          requirements: { artifactType: string; state: string }[]
        }),
      },
    ]),
  )

  return (
    <div>
      <PageHeader
        eyebrow="Enable"
        title="Consumption patterns"
        description="Eight named ways a product gets consumed, what each requires, and whether a given product is actually ready for it."
      />

      <Card className="mb-8">
        <CardHeader
          title="Readiness matrix"
          description="Green where the required artifact exists and its stage gate is approved, amber where drafted, red where absent."
          actions={
            <form method="get" className="flex items-center gap-2">
              <label htmlFor="product" className="text-xs text-ink-600">
                Product
              </label>
              <select
                id="product"
                name="product"
                defaultValue={selected}
                className="rounded-md border border-ink-300 px-2 py-1 text-sm"
              >
                {products.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-ink-300 px-2 py-1 text-xs hover:bg-ink-50">
                Show
              </button>
            </form>
          }
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-2">Pattern</th>
                <th className="px-3 py-2">Requires</th>
                <th className="px-3 py-2">Minimum stage</th>
                <th className="px-5 py-2">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {CONSUMPTION_PATTERNS.map((pattern) => {
                const state = readiness.get(pattern.key)
                const tone =
                  !state || !state.targeted
                    ? 'neutral'
                    : state.readiness === 'READY'
                      ? 'good'
                      : state.readiness === 'DRAFTED'
                        ? 'warn'
                        : 'bad'
                return (
                  <tr key={pattern.key} className="border-t border-ink-100">
                    <td className="px-5 py-2 font-medium text-ink-900">{pattern.name}</td>
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {pattern.requiredArtifacts.map(artifactTitle).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-600">Stage {pattern.minimumApprovedStage}</td>
                    <td className="px-5 py-2">
                      <Badge tone={tone}>
                        {!state ? 'no data' : !state.targeted ? 'not targeted' : state.readiness}
                      </Badge>
                      {state?.blockedReason && state.targeted ? (
                        <p className="mt-1 text-xs text-ink-500">{state.blockedReason}</p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Learn</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {CONSUMPTION_PATTERNS.map((pattern) => (
          <Card key={pattern.key} as="article">
            <CardHeader title={pattern.name} description={pattern.description} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-ink-700">
                <strong>Consumer:</strong> {pattern.consumerPersona} · <strong>Latency:</strong>{' '}
                {pattern.latencyProfile} · <strong>Freshness:</strong> {pattern.freshnessProfile}
              </p>
              <p className="text-ink-700">
                <strong>Interface contract:</strong> {pattern.interfaceContract}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Guardrails</p>
                <ul className="mt-1 list-disc pl-5 text-ink-700">
                  {pattern.guardrails.map((guardrail) => (
                    <li key={guardrail}>{guardrail}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Anti-patterns</p>
                <ul className="mt-1 list-disc pl-5 text-ink-700">
                  {pattern.antiPatterns.map((antiPattern) => (
                    <li key={antiPattern}>{antiPattern}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Readiness checklist</p>
                <ul className="mt-1 list-disc pl-5 text-ink-700">
                  {pattern.readinessChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-600">
        Conversational and agentic patterns are unavailable until Stage 10 is approved, and the
        grounding validator rejects any reference to a Bronze or Silver table. See{' '}
        <Link href="/academy/stage-10" className="text-accent-600 underline">
          the Stage 10 guide
        </Link>
        .
      </p>
    </div>
  )
}
