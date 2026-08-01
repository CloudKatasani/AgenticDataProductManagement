import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { ARCHETYPE_LABELS, type Archetype } from '@/lib/domain/enums'
import { Badge, Card, CardBody, EmptyState, PageHeader, type Tone } from '@/components/ui'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, Tone> = {
  IN_PROGRESS: 'info',
  CERTIFIED: 'good',
  PUBLISHED: 'good',
  DEPRECATED: 'warn',
  RETIRED: 'neutral',
}

export default async function ProductsPage() {
  const session = await requireSession()
  const products = await prisma.dataProduct.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    include: {
      owner: true,
      domain: true,
      gates: { select: { stageNumber: true, state: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  })

  return (
    <div>
      <PageHeader
        eyebrow="Build"
        title="Lifecycle Studio"
        description="Every product in this workspace and where it actually is. A product only exists here because a product owner approved a request."
      />

      {products.length === 0 ? (
        <EmptyState title="No data products in this workspace yet.">
          <p>
            Products are created by triaging a request —{' '}
            <Link href="/inbox" className="text-accent-600 underline">
              start at your inbox
            </Link>
            .
          </p>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const approved = product.gates.filter((g) => g.state === 'APPROVED').length
            const stale = product.gates.filter((g) => g.state === 'STALE').length
            const open = product.gates.filter((g) => g.state === 'OPEN').length
            return (
              <Card key={product.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-[260px] flex-1">
                    <h2 className="text-sm font-semibold text-ink-900">
                      <Link href={`/products/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                      <span className="ml-2 font-mono text-xs font-normal text-ink-500">
                        v{product.semanticVersion}
                      </span>
                    </h2>
                    <p className="text-xs text-ink-500">
                      {product.domain.name} · owner {product.owner.name} ·{' '}
                      {ARCHETYPE_LABELS[product.archetype as Archetype] ?? product.archetype}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[product.status] ?? 'neutral'}>{product.status}</Badge>
                    <Badge tone="info">Stage {product.currentStage}</Badge>
                    <Badge tone="good">{approved}/12 approved</Badge>
                    {open > 0 ? <Badge tone="info">{open} gate open</Badge> : null}
                    {stale > 0 ? <Badge tone="warn">{stale} stale</Badge> : null}
                    <Link
                      href={`/products/${product.id}/stage/${product.currentStage}`}
                      className="rounded-md border border-ink-300 px-2.5 py-1 text-xs hover:bg-ink-50"
                    >
                      Open Stage {product.currentStage}
                    </Link>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
