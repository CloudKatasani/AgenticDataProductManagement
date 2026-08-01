import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { findNearMatches } from '@/lib/requests/duplicates'
import { patternName } from '@/lib/patterns/registry'
import { ActionForm } from '@/components/forms'
import { replyToRequest } from '../actions'
import { TriagePanel } from './triage-panel'
import { Badge, Card, CardBody, CardHeader, DataList, Field, PageHeader, inputClass } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const request = await prisma.productRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      triagedBy: true,
      product: true,
      messages: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!request || request.workspaceId !== session.workspaceId) notFound()

  const questions = JSON.parse(request.questionsJson) as string[]
  const canTriage = session.roles.includes('DOMAIN_PRODUCT_OWNER')
  const domains = await prisma.domain.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { name: 'asc' },
  })
  const products = await prisma.dataProduct.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  const nearMatches = canTriage
    ? await findNearMatches({
        workspaceId: session.workspaceId,
        decision: request.decision,
        consumerRole: request.consumerRole,
        questions,
        excludeRequestId: request.id,
      })
    : []

  const overdue = !!request.slaDueAt && !request.triagedAt && request.slaDueAt.getTime() < Date.now()

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/request" className="text-accent-600 underline">
          ← My requests
        </Link>
      </p>
      <PageHeader
        eyebrow={`${request.reference} · ${request.state}`}
        title={request.title}
        description={request.decision}
        actions={
          overdue ? <Badge tone="bad">Triage target breached</Badge> : <Badge tone="info">{request.state}</Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What the requester told us" />
            <CardBody>
              <DataList
                rows={[
                  { label: 'Who is blocked', value: request.consumerRole },
                  { label: 'People affected', value: request.peopleAffected },
                  { label: 'Cadence', value: request.cadence },
                  { label: 'Current workaround', value: request.currentWorkaround },
                  { label: 'Time taken today', value: request.timeTakenToday },
                  { label: 'Required freshness', value: request.requiredFreshness },
                  {
                    label: 'Preferred pattern',
                    value: request.preferredPatternKey ? patternName(request.preferredPatternKey) : 'No preference',
                  },
                  { label: 'Sensitivity noted', value: request.sensitivityNotes || 'None stated' },
                ]}
              />
              <h3 className="mt-5 text-sm font-semibold text-ink-900">Questions they would ask</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-800">
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              <h3 className="mt-5 text-sm font-semibold text-ink-900">The stakes</h3>
              <p className="mt-1 text-sm text-ink-700">{request.stakes}</p>
              {request.quantifiedImpact ? (
                <p className="mt-1 text-sm text-ink-700">{request.quantifiedImpact}</p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Thread" description="Every clarification is anchored here, visible to the requester." />
            <CardBody>
              {request.messages.length === 0 ? (
                <p className="text-sm text-ink-600">No messages yet.</p>
              ) : (
                <ul className="space-y-3">
                  {request.messages.map((message) => (
                    <li key={message.id} className="rounded-md border border-ink-200 px-3 py-2">
                      <p className="text-xs text-ink-500">
                        {message.author.name} · {message.kind} ·{' '}
                        {message.createdAt.toLocaleString('en-GB')}
                      </p>
                      <p className="mt-1 text-sm text-ink-800">{message.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <ActionForm action={replyToRequest} submitLabel="Post reply" variant="secondary">
                  <input type="hidden" name="requestId" value={request.id} />
                  <Field label="Reply" htmlFor="body">
                    <textarea id="body" name="body" rows={3} className={inputClass} required />
                  </Field>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status history" />
            <CardBody className="text-sm text-ink-700">
              <ul className="space-y-1">
                <li>Submitted {request.submittedAt?.toLocaleString('en-GB') ?? '—'}</li>
                <li>Triage target {request.slaDueAt?.toLocaleString('en-GB') ?? '—'}</li>
                <li>
                  Triaged{' '}
                  {request.triagedAt
                    ? `${request.triagedAt.toLocaleString('en-GB')} by ${request.triagedBy?.name}`
                    : 'not yet'}
                </li>
                {request.product ? (
                  <li>
                    Became{' '}
                    <Link href={`/products/${request.product.id}`} className="text-accent-600 underline">
                      {request.product.name}
                    </Link>
                  </li>
                ) : null}
                {request.declineReason ? <li>Declined: {request.declineReason}</li> : null}
              </ul>
            </CardBody>
          </Card>

          {canTriage ? (
            <TriagePanel
              requestId={request.id}
              state={request.state}
              domains={domains.map((d) => ({ id: d.id, name: d.name }))}
              products={products}
              nearMatches={nearMatches}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
