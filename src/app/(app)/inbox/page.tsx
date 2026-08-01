import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { roleName } from '@/lib/domain/roles'
import { getStage } from '@/lib/lifecycle/stages'
import { agentName } from '@/lib/agents/registry'
import { decideAccessRequest } from '../marketplace/actions'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const session = await requireSession()

  const openGates = await prisma.gate.findMany({
    where: { state: { in: ['OPEN', 'STALE'] }, product: { workspaceId: session.workspaceId } },
    include: { product: true, approvals: true },
    orderBy: { openedAt: 'asc' },
  })

  const myApprovals = openGates.filter((gate) => {
    const stage = getStage(gate.stageNumber)
    const eligible = session.roles.some(
      (role) => stage.approverRoles.includes(role) || stage.vetoRoles.includes(role),
    )
    const alreadyVoted = gate.approvals.some((a) => a.userId === session.userId)
    return eligible && !alreadyVoted
  })

  const staleGates = openGates.filter((gate) => gate.state === 'STALE')

  const ownedRuns = await prisma.stageRun.findMany({
    where: {
      state: { in: ['DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW'] },
      product: {
        workspaceId: session.workspaceId,
        archivedAt: null,
        OR: [{ ownerId: session.userId }, { stewardId: session.userId }],
      },
    },
    include: { product: true },
    orderBy: { openedAt: 'asc' },
  })

  const openComments = await prisma.comment.findMany({
    where: {
      resolvedAt: null,
      kind: { in: ['REVIEW', 'AGENT_CRITIC'] },
      product: { workspaceId: session.workspaceId },
    },
    include: { product: true, author: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const proposals = await prisma.agentProposal.findMany({
    where: { state: 'PENDING', product: { workspaceId: session.workspaceId } },
    include: { product: true, agentAction: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const triageQueue = session.roles.includes('DOMAIN_PRODUCT_OWNER')
    ? await prisma.productRequest.findMany({
        where: {
          workspaceId: session.workspaceId,
          state: { in: ['SUBMITTED', 'IN_TRIAGE'] },
        },
        include: { requester: true },
        orderBy: { submittedAt: 'asc' },
      })
    : []

  const accessQueue =
    session.roles.includes('DOMAIN_PRODUCT_OWNER') || session.roles.includes('PRIVACY_SECURITY_OFFICER')
      ? await prisma.accessRequest.findMany({
          where: { state: 'PENDING', product: { workspaceId: session.workspaceId } },
          include: { product: true, requester: true },
          orderBy: { createdAt: 'asc' },
        })
      : []

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: session.workspaceId,
      completedAt: null,
      OR: [
        { assigneeUserId: session.userId },
        { assigneeRoleKey: { in: session.roles } },
      ],
    },
    include: { product: true, request: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })

  const nothing =
    myApprovals.length === 0 &&
    ownedRuns.length === 0 &&
    openComments.length === 0 &&
    proposals.length === 0 &&
    triageQueue.length === 0 &&
    accessQueue.length === 0 &&
    tasks.length === 0

  return (
    <div>
      <PageHeader
        eyebrow="Build"
        title="My work"
        description={`Everything waiting on you as ${session.roles.map(roleName).join(', ') || 'an unassigned user'} in ${session.workspaceName}.`}
      />

      {nothing ? <EmptyState title="Nothing is waiting on you right now." /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {myApprovals.length > 0 ? (
          <Card>
            <CardHeader
              title={`Approvals pending on you (${myApprovals.length})`}
              description="You hold an approver or veto role on these gates and have not yet voted."
            />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {myApprovals.map((gate) => (
                  <li key={gate.id} className="flex items-center justify-between gap-3">
                    <span>
                      <Link
                        href={`/products/${gate.productId}/stage/${gate.stageNumber}`}
                        className="font-medium text-accent-600 hover:underline"
                      >
                        {gate.product.name}
                      </Link>{' '}
                      <span className="text-ink-600">
                        Stage {gate.stageNumber} — {getStage(gate.stageNumber).name}
                      </span>
                    </span>
                    <Badge tone={gate.state === 'STALE' ? 'warn' : 'info'}>{gate.state}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {triageQueue.length > 0 ? (
          <Card>
            <CardHeader
              title={`Requests to triage (${triageQueue.length})`}
              description="An intake process without a published response target is a suggestion box."
            />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {triageQueue.map((request) => {
                  const overdue = request.slaDueAt ? request.slaDueAt.getTime() < Date.now() : false
                  return (
                    <li key={request.id} className="flex items-center justify-between gap-3">
                      <span>
                        <Link href={`/request/${request.id}`} className="font-medium text-accent-600 hover:underline">
                          {request.reference} — {request.title}
                        </Link>
                        <span className="ml-2 text-xs text-ink-500">from {request.requester.name}</span>
                      </span>
                      <Badge tone={overdue ? 'bad' : 'info'}>{overdue ? 'target breached' : request.state}</Badge>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {ownedRuns.length > 0 ? (
          <Card>
            <CardHeader title={`Stages you own (${ownedRuns.length})`} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {ownedRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/products/${run.productId}/stage/${run.stageNumber}`}
                      className="font-medium text-accent-600 hover:underline"
                    >
                      {run.product.name} — Stage {run.stageNumber}
                    </Link>
                    <Badge tone={run.state === 'CHANGES_REQUESTED' ? 'warn' : 'neutral'}>{run.state}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {proposals.length > 0 ? (
          <Card>
            <CardHeader
              title={`Agent proposals awaiting disposition (${proposals.length})`}
              description="An artifact cannot be submitted while any of these remain unreviewed."
            />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {proposals.map((proposal) => (
                  <li key={proposal.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/products/${proposal.productId}/stage/${proposal.stageNumber}`}
                      className="text-accent-600 hover:underline"
                    >
                      {proposal.product.name} — {proposal.fieldPath}
                    </Link>
                    <Badge tone="agent">{agentName(proposal.agentAction.agentId)}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {staleGates.length > 0 ? (
          <Card>
            <CardHeader
              title={`Stale gates (${staleGates.length})`}
              description="An approval decayed because the evidence beneath it changed."
            />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {staleGates.map((gate) => (
                  <li key={gate.id}>
                    <Link
                      href={`/products/${gate.productId}/stage/${gate.stageNumber}`}
                      className="text-accent-600 hover:underline"
                    >
                      {gate.product.name} — Stage {gate.stageNumber}
                    </Link>
                    <p className="text-xs text-ink-500">{gate.staleReason}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {openComments.length > 0 ? (
          <Card>
            <CardHeader title={`Open review comments (${openComments.length})`} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {openComments.map((comment) => (
                  <li key={comment.id}>
                    <Link
                      href={`/products/${comment.productId}/stage/${comment.stageNumber}`}
                      className="text-accent-600 hover:underline"
                    >
                      {comment.product.name} — Stage {comment.stageNumber}
                    </Link>
                    <p className="text-xs text-ink-600">
                      {comment.author.name}: {comment.body.slice(0, 140)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {accessQueue.length > 0 ? (
          <Card>
            <CardHeader title={`Access requests (${accessQueue.length})`} />
            <CardBody>
              <ul className="space-y-3 text-sm">
                {accessQueue.map((request) => (
                  <li key={request.id} className="rounded-md border border-ink-200 px-3 py-2">
                    <p className="text-ink-800">
                      {request.requester.name} → {request.product.name}
                    </p>
                    <p className="text-xs text-ink-600">{request.purpose}</p>
                    <form action={decideAccessRequest} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="accessRequestId" value={request.id} />
                      <input
                        name="note"
                        placeholder="Decision note"
                        className="flex-1 rounded-md border border-ink-300 px-2 py-1 text-sm"
                      />
                      <Button name="decision" value="APPROVED">
                        Approve
                      </Button>
                      <Button name="decision" value="DENIED" variant="danger">
                        Deny
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {tasks.length > 0 ? (
          <Card>
            <CardHeader title={`Tasks (${tasks.length})`} />
            <CardBody>
              <ul className="space-y-1 text-sm">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-800">
                      {task.product ? (
                        <Link href={`/products/${task.productId}`} className="text-accent-600 hover:underline">
                          {task.title}
                        </Link>
                      ) : task.request ? (
                        <Link href={`/request/${task.requestId}`} className="text-accent-600 hover:underline">
                          {task.title}
                        </Link>
                      ) : (
                        task.title
                      )}
                    </span>
                    <Badge tone={task.kind === 'RE_APPROVAL' ? 'warn' : 'neutral'}>{task.kind}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
