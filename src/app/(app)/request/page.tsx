import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, type Tone } from '@/components/ui'

export const dynamic = 'force-dynamic'

const STATE_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  IN_TRIAGE: 'info',
  INFO_REQUESTED: 'warn',
  APPROVED: 'good',
  DECLINED: 'bad',
  MERGED: 'neutral',
  DEFERRED: 'warn',
}

export default async function MyRequestsPage() {
  const session = await requireSession()
  const mine = await prisma.productRequest.findMany({
    where: { workspaceId: session.workspaceId, requesterId: session.userId },
    orderBy: { createdAt: 'desc' },
    include: { product: true, messages: true },
  })

  return (
    <div>
      <PageHeader
        eyebrow="Consume"
        title="My requests"
        description="You can always see exactly where your request is. Opacity here is what kills intake processes in real organisations."
        actions={<LinkButton href="/request/new" variant="primary">New request</LinkButton>}
      />

      {mine.length === 0 ? (
        <EmptyState title="You have not raised a request yet.">
          <p>
            Start by describing a decision you cannot make today —{' '}
            <Link href="/request/new" className="text-accent-600 underline">
              five short screens
            </Link>
            .
          </p>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {mine.map((request) => (
            <Card key={request.id}>
              <CardHeader
                title={
                  <Link href={`/request/${request.id}`} className="hover:underline">
                    {request.reference} — {request.title}
                  </Link>
                }
                description={request.decision}
                actions={<Badge tone={STATE_TONE[request.state] ?? 'neutral'}>{request.state}</Badge>}
              />
              <CardBody className="text-sm text-ink-600">
                <p>
                  Submitted {request.submittedAt?.toLocaleDateString('en-GB') ?? '—'} ·{' '}
                  {request.messages.length} message(s) in the thread
                  {request.slaDueAt && !request.triagedAt ? (
                    <>
                      {' '}
                      · triage target {request.slaDueAt.toLocaleDateString('en-GB')}
                      {request.slaDueAt.getTime() < Date.now() ? (
                        <span className="ml-2 font-medium text-rose-700">target breached</span>
                      ) : null}
                    </>
                  ) : null}
                </p>
                {request.state === 'DECLINED' && request.declineReason ? (
                  <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                    Declined: {request.declineReason}
                  </p>
                ) : null}
                {request.product ? (
                  <p className="mt-2">
                    Became{' '}
                    <Link href={`/products/${request.product.id}`} className="text-accent-600 underline">
                      {request.product.name}
                    </Link>{' '}
                    (Stage {request.product.currentStage}).
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
