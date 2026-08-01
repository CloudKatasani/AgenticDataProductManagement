'use client'

import { useActionState, useState } from 'react'
import {
  addCommentAction,
  commitArtifactAction,
  dispositionProposalAction,
  recordDecisionAction,
  runAgentAction,
  stageTransitionAction,
  resolveCommentAction,
  type Result,
} from '@/app/(app)/products/actions'
import type { StageView } from '@/lib/queries/studio'
import { PROVENANCE_LABELS, type Provenance } from '@/lib/domain/enums'
import { roleName } from '@/lib/domain/roles'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorText,
  Field,
  inputClass,
} from '@/components/ui'

function ResultBanner({ result }: { result: Result | undefined }) {
  if (!result) return null
  return (
    <div className="mt-3">
      {result.ok ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {result.ok}
        </p>
      ) : null}
      {result.error ? (
        <ErrorText>
          {result.error}
          {result.details?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {result.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </ErrorText>
      ) : null}
    </div>
  )
}

export function ArtifactEditor({
  artifact,
  productId,
  hasAcceptedProposals,
}: {
  artifact: StageView['artifacts'][number]
  productId: string
  hasAcceptedProposals: boolean
}) {
  const [open, setOpen] = useState(false)
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    commitArtifactAction,
    undefined,
  )
  const unreviewed = artifact.provenance.filter((p) => p.provenance === 'AGENT_PROPOSED')

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {artifact.title}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-normal text-ink-600">
              {artifact.fileName}
            </code>
            {artifact.version ? (
              <Badge tone="info">v{artifact.version}</Badge>
            ) : (
              <Badge tone="warn">not committed</Badge>
            )}
          </span>
        }
        description={artifact.description}
        actions={
          <Button type="button" variant="secondary" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'View / edit'}
          </Button>
        }
      />
      {artifact.provenance.length > 0 ? (
        <div className="border-b border-ink-200 bg-agent-50 px-5 py-2 text-xs text-agent-700">
          {artifact.provenance.length} field(s) carry agent provenance
          {unreviewed.length > 0 ? (
            <strong> — {unreviewed.length} still unreviewed, which blocks submission.</strong>
          ) : (
            <>
              :{' '}
              {[...new Set(artifact.provenance.map((p) => PROVENANCE_LABELS[p.provenance as Provenance]))].join(
                ', ',
              )}
            </>
          )}
        </div>
      ) : null}
      {open ? (
        <CardBody>
          {artifact.diff ? (
            <details className="mb-3 rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-ink-800">
                Diff v{artifact.diff.fromVersion} → v{artifact.diff.toVersion} ({artifact.diff.summary})
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {artifact.diff.changes.map((change) => (
                  <li key={`${change.path}-${change.change}`}>
                    <span className="text-ink-500">{change.path}</span>{' '}
                    <span
                      className={
                        change.change === 'ADDED'
                          ? 'text-emerald-700'
                          : change.change === 'REMOVED'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                      }
                    >
                      {change.change}
                    </span>{' '}
                    {change.before ? <span className="text-rose-700">{change.before}</span> : null}
                    {change.before && change.after ? ' → ' : null}
                    {change.after ? <span className="text-emerald-700">{change.after}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="artifactType" value={artifact.type} />
            <Field label="Content (YAML)" htmlFor={`content-${artifact.type}`}>
              <textarea
                id={`content-${artifact.type}`}
                name="content"
                rows={18}
                defaultValue={artifact.yaml}
                spellCheck={false}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>
            <Field label="Commit message" htmlFor={`message-${artifact.type}`}>
              <input id={`message-${artifact.type}`} name="message" className={inputClass} />
            </Field>
            {hasAcceptedProposals ? (
              <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="applyProposals" value="true" defaultChecked />
                Fold accepted agent proposals into this commit and record their provenance
              </label>
            ) : null}
            <Button disabled={pending}>{pending ? 'Committing…' : 'Commit new version'}</Button>
            <ResultBanner result={result} />
          </form>
        </CardBody>
      ) : null}
    </Card>
  )
}

export function AgentPanel({
  view,
  productId,
  agentsEnabled,
  providerLabel,
}: {
  view: StageView
  productId: string
  agentsEnabled: boolean
  providerLabel: string
}) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    runAgentAction,
    undefined,
  )
  const pendingProposals = view.proposals.filter((p) => p.state === 'PENDING')
  const dispositioned = view.proposals.filter((p) => p.state !== 'PENDING')

  return (
    <Card>
      <CardHeader
        title="Agent assist"
        description={`Agents act; you decide. ${providerLabel}`}
      />
      <CardBody>
        {!agentsEnabled ? (
          <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
            Agents are disabled for this workspace. Every stage is completable without them — that is
            a design requirement, not a fallback.
          </p>
        ) : (
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="stageNumber" value={view.stage.number} />
            <div className="min-w-[220px] flex-1">
              <label htmlFor="agentId" className="mb-1 block text-sm font-medium text-ink-800">
                Agent
              </label>
              <select id="agentId" name="agentId" className={inputClass}>
                {view.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} — {agent.charter}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={pending || view.agents.length === 0}>
              {pending ? 'Running…' : 'Run agent'}
            </Button>
          </form>
        )}
        <ResultBanner result={result} />

        <div className="mt-4 space-y-3">
          {pendingProposals.length === 0 ? (
            <p className="text-sm text-ink-600">No proposals awaiting disposition.</p>
          ) : (
            pendingProposals.map((proposal) => (
              <div key={proposal.id} className="agent-proposed rounded-md p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="agent">{proposal.agentId}</Badge>
                  <code className="text-xs text-ink-600">{proposal.fieldPath}</code>
                  <Badge tone="warn">Not yet reviewed</Badge>
                </div>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-xs text-ink-800">
                  {proposal.preview}
                </pre>
                {proposal.rationale ? (
                  <p className="mt-1 text-xs italic text-ink-600">{proposal.rationale}</p>
                ) : null}
                <form action={dispositionProposalAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="proposalId" value={proposal.id} />
                  {!proposal.isComment ? (
                    <div className="flex-1">
                      <label htmlFor={`edit-${proposal.id}`} className="mb-1 block text-xs text-ink-600">
                        Edit before accepting (YAML)
                      </label>
                      <textarea
                        id={`edit-${proposal.id}`}
                        name="editedValue"
                        rows={3}
                        className={`${inputClass} font-mono text-xs`}
                        defaultValue={proposal.preview}
                      />
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button name="action" value="ACCEPT" variant="primary">
                      Accept
                    </Button>
                    {!proposal.isComment ? (
                      <Button name="action" value="EDIT_ACCEPT" variant="secondary">
                        Edit &amp; accept
                      </Button>
                    ) : null}
                    <Button name="action" value="REJECT" variant="danger">
                      Reject
                    </Button>
                  </div>
                </form>
              </div>
            ))
          )}
        </div>

        {dispositioned.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-ink-700">
              {dispositioned.length} dispositioned proposal(s)
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-600">
              {dispositioned.map((proposal) => (
                <li key={proposal.id}>
                  <Badge tone={proposal.state === 'REJECTED' ? 'bad' : 'good'}>{proposal.state}</Badge>{' '}
                  <code>{proposal.fieldPath}</code> · {proposal.agentId}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardBody>
    </Card>
  )
}

export function GatePanel({
  view,
  canApprove,
  myRoles,
}: {
  view: StageView
  canApprove: boolean
  myRoles: string[]
}) {
  const [transitionResult, transitionAction, transitionPending] = useActionState<Result | undefined, FormData>(
    stageTransitionAction,
    undefined,
  )
  const [decisionResult, decisionAction, decisionPending] = useActionState<Result | undefined, FormData>(
    recordDecisionAction,
    undefined,
  )

  const eligibleRoles = myRoles.filter(
    (role) => view.stage.approverRoles.includes(role as never) || view.stage.vetoRoles.includes(role as never),
  )

  return (
    <Card>
      <CardHeader
        title="Gate"
        description={`Quorum ${view.stage.quorum} of ${view.stage.approverRoles.map(roleName).join(', ')}${
          view.stage.vetoRoles.length ? ` · veto: ${view.stage.vetoRoles.map(roleName).join(', ')}` : ''
        }`}
        actions={
          <Badge
            tone={
              view.gate?.state === 'APPROVED'
                ? 'good'
                : view.gate?.state === 'STALE'
                  ? 'warn'
                  : view.gate?.state === 'REJECTED'
                    ? 'bad'
                    : 'neutral'
            }
          >
            {view.gate?.state ?? 'PENDING'}
          </Badge>
        }
      />
      <CardBody>
        <p className="mb-3 text-sm text-ink-600">
          Stage run is <strong>{view.run.state}</strong> (attempt {view.run.attempt}).
        </p>
        {view.gate?.staleReason ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {view.gate.staleReason}
          </p>
        ) : null}

        <form action={transitionAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="productId" value={view.product.id} />
          <input type="hidden" name="stageNumber" value={view.stage.number} />
          <Button name="action" value="SUBMIT_FOR_REVIEW" disabled={transitionPending} variant="primary">
            Submit for review
          </Button>
          <Button name="action" value="OPEN_GATE" disabled={transitionPending} variant="secondary">
            Open gate
          </Button>
          <Button name="action" value="REQUEST_CHANGES" disabled={transitionPending} variant="secondary">
            Request changes
          </Button>
          <Button name="action" value="WITHDRAW_TO_DRAFT" disabled={transitionPending} variant="ghost">
            Withdraw to draft
          </Button>
        </form>
        <ResultBanner result={transitionResult} />

        {view.gate && view.gate.state === 'OPEN' && canApprove ? (
          <form action={decisionAction} className="mt-4 border-t border-ink-200 pt-4">
            <input type="hidden" name="gateId" value={view.gate.id} />
            <Field label="Vote as" htmlFor="roleKey" required>
              <select id="roleKey" name="roleKey" className={inputClass}>
                {eligibleRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleName(role)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rationale" htmlFor="rationale">
              <textarea id="rationale" name="rationale" rows={2} className={inputClass} />
            </Field>
            <div className="flex gap-2">
              <Button name="decision" value="APPROVE" disabled={decisionPending}>
                Approve
              </Button>
              <Button name="decision" value="REJECT" variant="danger" disabled={decisionPending}>
                Reject
              </Button>
              <Button name="decision" value="ABSTAIN" variant="ghost" disabled={decisionPending}>
                Abstain
              </Button>
            </div>
          </form>
        ) : null}
        <ResultBanner result={decisionResult} />

        {view.gate && view.gate.approvals.length > 0 ? (
          <ul className="mt-4 space-y-1 border-t border-ink-200 pt-3 text-sm">
            {view.gate.approvals.map((approval) => (
              <li key={`${approval.roleKey}-${approval.userName}`} className="flex flex-wrap gap-2">
                <Badge tone={approval.decision === 'APPROVE' ? 'good' : approval.decision === 'REJECT' ? 'bad' : 'neutral'}>
                  {approval.decision}
                </Badge>
                <span className="text-ink-800">
                  {approval.userName} as {roleName(approval.roleKey)}
                </span>
                {approval.rationale ? <span className="text-ink-500">— {approval.rationale}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  )
}

export function ReviewThread({ view }: { view: StageView }) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    addCommentAction,
    undefined,
  )
  const review = view.comments.filter((c) => c.kind !== 'PARKING_LOT')
  const parkingLot = view.comments.filter((c) => c.kind === 'PARKING_LOT')

  return (
    <Card>
      <CardHeader title="Review thread" description="Comments anchor to a field, not to a vibe." />
      <CardBody>
        <ul className="space-y-2">
          {review.length === 0 ? <p className="text-sm text-ink-600">No review comments.</p> : null}
          {review.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-md border px-3 py-2 ${
                comment.resolvedAt ? 'border-ink-200 bg-ink-50' : 'border-ink-300 bg-white'
              }`}
            >
              <p className="text-xs text-ink-500">
                {comment.authorName} · {comment.kind}
                {comment.fieldPath ? ` · ${comment.fieldPath}` : ''} ·{' '}
                {comment.createdAt.toLocaleString('en-GB')}
                {comment.resolvedAt ? ' · resolved' : ''}
              </p>
              <p className="mt-1 text-sm text-ink-800">{comment.body}</p>
              {!comment.resolvedAt ? (
                <form action={resolveCommentAction} className="mt-2">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <Button variant="ghost">Resolve</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>

        {parkingLot.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-800">
              Parking lot ({parkingLot.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              {parkingLot.map((item) => (
                <li key={item.id}>
                  {item.body} <span className="text-xs text-ink-500">— {item.authorName}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <form action={formAction} className="mt-4 border-t border-ink-200 pt-4">
          <input type="hidden" name="productId" value={view.product.id} />
          <input type="hidden" name="stageNumber" value={view.stage.number} />
          <Field label="Comment" htmlFor="comment-body">
            <textarea id="comment-body" name="body" rows={2} className={inputClass} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Anchor to field path" htmlFor="fieldPath" hint="e.g. decisions[0].questions">
              <input id="fieldPath" name="fieldPath" className={inputClass} />
            </Field>
            <Field label="Kind" htmlFor="kind">
              <select id="kind" name="kind" className={inputClass} defaultValue="REVIEW">
                <option value="REVIEW">Review</option>
                <option value="NOTE">Note</option>
                <option value="PARKING_LOT">Parking lot</option>
              </select>
            </Field>
          </div>
          <Button disabled={pending} variant="secondary">
            {pending ? 'Posting…' : 'Add comment'}
          </Button>
          <ResultBanner result={result} />
        </form>
      </CardBody>
    </Card>
  )
}
