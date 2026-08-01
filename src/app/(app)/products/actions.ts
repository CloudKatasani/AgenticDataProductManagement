'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { parse as parseYaml } from 'yaml'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { assertRole } from '@/lib/auth/authorise'
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit/log'
import { ArtifactValidationError, commitArtifact } from '@/lib/artifacts/commit'
import { getArtifactType } from '@/lib/artifacts/registry'
import { recordDecision, requestTransition, TransitionError } from '@/lib/lifecycle/transitions'
import {
  acceptCriticComment,
  applyAcceptedProposals,
  dispositionProposal,
  invokeAgent,
  AgentError,
} from '@/lib/agents/runtime'
import { decisionSchema } from '@/lib/domain/enums'

export interface Result {
  ok?: string
  error?: string
  details?: string[]
}

function refresh(productId: string, stageNumber?: number) {
  revalidatePath(`/products/${productId}`)
  if (stageNumber) revalidatePath(`/products/${productId}/stage/${stageNumber}`)
  revalidatePath('/inbox')
}

export async function commitArtifactAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const artifactType = String(formData.get('artifactType') ?? '')
  const body = String(formData.get('content') ?? '')
  const message = String(formData.get('message') ?? '')
  const applyProposals = String(formData.get('applyProposals') ?? '') === 'true'

  const type = getArtifactType(artifactType)
  let content: unknown
  try {
    content = parseYaml(body)
  } catch (error) {
    return { error: `That is not valid YAML: ${error instanceof Error ? error.message : 'parse error'}` }
  }

  let provenance: { fieldPath: string; provenance: 'AGENT_ACCEPTED' | 'AGENT_EDITED'; agentId: string; acceptedById: string }[] = []
  if (applyProposals) {
    const applied = await applyAcceptedProposals({
      productId,
      stageNumber: type.stage,
      baseContent: content,
    })
    content = applied.content
    provenance = applied.provenance.filter(
      (p): p is { fieldPath: string; provenance: 'AGENT_ACCEPTED' | 'AGENT_EDITED'; agentId: string; acceptedById: string } =>
        p.provenance === 'AGENT_ACCEPTED' || p.provenance === 'AGENT_EDITED',
    )
  }

  try {
    const result = await commitArtifact({
      productId,
      artifactType,
      content,
      userId: session.userId,
      message,
      provenance,
    })
    refresh(productId, type.stage)
    if (result.unchanged) return { ok: 'No change — content is identical to the current version.' }
    return {
      ok: `Committed ${type.title} v${result.version}.${
        result.staledGateIds.length
          ? ` ${result.staledGateIds.length} downstream approval(s) went stale and need re-approval.`
          : ''
      }`,
    }
  } catch (error) {
    if (error instanceof ArtifactValidationError) {
      return {
        error: error.message,
        details: error.issues.map((issue) => `${issue.path || '(root)'}: ${issue.message}`),
      }
    }
    return { error: error instanceof Error ? error.message : 'Commit failed.' }
  }
}

export async function stageTransitionAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const stageNumber = Number(formData.get('stageNumber') ?? 0)
  const action = String(formData.get('action') ?? '') as
    | 'SUBMIT_FOR_REVIEW'
    | 'REQUEST_CHANGES'
    | 'WITHDRAW_TO_DRAFT'
    | 'OPEN_GATE'
  const note = String(formData.get('note') ?? '')

  try {
    await requestTransition({ productId, stageNumber, action, userId: session.userId, note })
    refresh(productId, stageNumber)
    return { ok: `Stage ${stageNumber}: ${action.toLowerCase().replace(/_/g, ' ')}.` }
  } catch (error) {
    if (error instanceof TransitionError) {
      return {
        error: error.message,
        details: error.failures.map((failure) => `${failure.label} — ${failure.detail}`),
      }
    }
    return { error: error instanceof Error ? error.message : 'Transition failed.' }
  }
}

export async function recordDecisionAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const gateId = String(formData.get('gateId') ?? '')
  const decision = decisionSchema.parse(formData.get('decision'))
  const rationale = String(formData.get('rationale') ?? '')
  const roleKeyRaw = String(formData.get('roleKey') ?? '')

  try {
    const gate = await prisma.gate.findUniqueOrThrow({ where: { id: gateId } })
    const result = await recordDecision({
      gateId,
      userId: session.userId,
      decision,
      rationale,
      roleKey: roleKeyRaw ? (roleKeyRaw as never) : undefined,
    })
    refresh(gate.productId, gate.stageNumber)
    return {
      ok:
        result.gateState === 'APPROVED'
          ? `Gate approved. Stage ${gate.stageNumber} is locked and the next stage is open.`
          : result.gateState === 'REJECTED'
            ? 'Gate rejected. The stage is back with the authors.'
            : `Decision recorded. ${result.approvingRoles.length} of ${result.quorum} approvals; awaiting ${result.outstandingRoles.join(', ') || 'nobody'}.`,
    }
  } catch (error) {
    if (error instanceof TransitionError) return { error: error.message }
    return { error: error instanceof Error ? error.message : 'Could not record the decision.' }
  }
}

const commentSchema = z.object({
  productId: z.string().min(1),
  stageNumber: z.coerce.number().min(1).max(12),
  body: z.string().trim().min(2, 'Write a comment.'),
  fieldPath: z.string().trim().default(''),
  kind: z.enum(['REVIEW', 'NOTE', 'PARKING_LOT']).default('REVIEW'),
})

export async function addCommentAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const parsed = commentSchema.safeParse({
    productId: formData.get('productId'),
    stageNumber: formData.get('stageNumber'),
    body: formData.get('body'),
    fieldPath: formData.get('fieldPath'),
    kind: formData.get('kind'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Write a comment.' }

  const product = await prisma.dataProduct.findUniqueOrThrow({ where: { id: parsed.data.productId } })
  await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        productId: product.id,
        stageNumber: parsed.data.stageNumber,
        authorId: session.userId,
        kind: parsed.data.kind,
        body: parsed.data.body,
        fieldPath: parsed.data.fieldPath || null,
      },
    })
    await recordAudit(tx, {
      workspaceId: product.workspaceId,
      productId: product.id,
      actorId: session.userId,
      action: AUDIT_ACTIONS.COMMENT_ADDED,
      entityType: 'Comment',
      entityId: created.id,
      data: { stageNumber: parsed.data.stageNumber, kind: parsed.data.kind },
    })
  })
  refresh(product.id, parsed.data.stageNumber)
  return { ok: 'Comment added.' }
}

export async function resolveCommentAction(formData: FormData) {
  const session = await requireSession()
  const commentId = String(formData.get('commentId') ?? '')
  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: { product: true },
  })
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: comment.id },
      data: { resolvedAt: new Date(), resolvedById: session.userId },
    })
    await recordAudit(tx, {
      workspaceId: comment.product.workspaceId,
      productId: comment.productId,
      actorId: session.userId,
      action: AUDIT_ACTIONS.COMMENT_RESOLVED,
      entityType: 'Comment',
      entityId: comment.id,
      data: { stageNumber: comment.stageNumber },
    })
  })
  refresh(comment.productId, comment.stageNumber)
}

export async function runAgentAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const stageNumber = Number(formData.get('stageNumber') ?? 0)
  const agentId = String(formData.get('agentId') ?? '')

  try {
    const result = await invokeAgent({
      agentId,
      workspaceId: session.workspaceId,
      productId,
      stageNumber,
      userId: session.userId,
      trigger: 'MANUAL',
    })
    refresh(productId, stageNumber)
    return {
      ok: `${result.model === 'local-heuristic' ? 'Local heuristic run' : `Model ${result.model}`}: ${result.proposalCount} proposal(s), ${result.commentCount} comment(s), ${result.findingCount} finding(s). ${result.redactedFields.length} field(s) redacted before transmission. Nothing has been applied — disposition each item below.`,
    }
  } catch (error) {
    if (error instanceof AgentError) return { error: error.message }
    return { error: error instanceof Error ? error.message : 'The agent could not run.' }
  }
}

export async function dispositionProposalAction(formData: FormData) {
  const session = await requireSession()
  const proposalId = String(formData.get('proposalId') ?? '')
  const action = String(formData.get('action') ?? '') as 'ACCEPT' | 'EDIT_ACCEPT' | 'REJECT'
  const note = String(formData.get('note') ?? '')
  const editedRaw = String(formData.get('editedValue') ?? '')

  const proposal = await prisma.agentProposal.findUniqueOrThrow({ where: { id: proposalId } })
  const isComment = 'comment' in (JSON.parse(proposal.proposedValueJson) ?? {})

  if (isComment && action === 'ACCEPT') {
    await acceptCriticComment({ proposalId, userId: session.userId, note })
  } else {
    let editedValue: unknown
    if (action === 'EDIT_ACCEPT' && editedRaw) {
      try {
        editedValue = parseYaml(editedRaw)
      } catch {
        editedValue = editedRaw
      }
    }
    await dispositionProposal({ proposalId, userId: session.userId, action, editedValue, note })
  }
  refresh(proposal.productId, proposal.stageNumber)
}

const changeRequestSchema = z.object({
  productId: z.string().min(1),
  title: z.string().trim().min(5),
  detail: z.string().trim().default(''),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  versionBump: z.enum(['PATCH', 'MINOR', 'MAJOR']).default('PATCH'),
})

export async function raiseChangeRequestAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const parsed = changeRequestSchema.safeParse({
    productId: formData.get('productId'),
    title: formData.get('title'),
    detail: formData.get('detail'),
    severity: formData.get('severity'),
    versionBump: formData.get('versionBump'),
  })
  if (!parsed.success) return { error: 'Give the change request a title of at least five characters.' }

  const product = await prisma.dataProduct.findUniqueOrThrow({ where: { id: parsed.data.productId } })
  await prisma.$transaction(async (tx) => {
    const created = await tx.changeRequest.create({
      data: {
        productId: product.id,
        raisedById: session.userId,
        title: parsed.data.title,
        detail: parsed.data.detail,
        severity: parsed.data.severity,
        versionBump: parsed.data.versionBump,
        state: 'OPEN',
      },
    })
    await recordAudit(tx, {
      workspaceId: product.workspaceId,
      productId: product.id,
      actorId: session.userId,
      action: AUDIT_ACTIONS.CHANGE_REQUEST_RAISED,
      entityType: 'ChangeRequest',
      entityId: created.id,
      data: { severity: parsed.data.severity, versionBump: parsed.data.versionBump },
    })
  })
  refresh(product.id, 12)
  return { ok: 'Change request raised.' }
}

export async function dispositionChangeRequestAction(formData: FormData) {
  const session = await requireSession()
  const changeRequestId = String(formData.get('changeRequestId') ?? '')
  const state = String(formData.get('state') ?? '') as 'ACCEPTED' | 'REJECTED' | 'DONE'
  const note = String(formData.get('note') ?? '')

  const cr = await prisma.changeRequest.findUniqueOrThrow({
    where: { id: changeRequestId },
    include: { product: true },
  })
  await assertRole(
    session.userId,
    cr.product.workspaceId,
    ['DOMAIN_PRODUCT_OWNER', 'GOVERNANCE_COUNCIL'],
    'Dispositioning a change request',
  )

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.update({
      where: { id: cr.id },
      data: {
        state,
        dispositionById: session.userId,
        dispositionAt: new Date(),
        dispositionNote: note,
      },
    })

    if (state === 'ACCEPTED') {
      const [major = '0', minor = '0', patch = '0'] = cr.product.semanticVersion.split('.')
      const bumped =
        cr.versionBump === 'MAJOR'
          ? `${Number(major) + 1}.0.0`
          : cr.versionBump === 'MINOR'
            ? `${major}.${Number(minor) + 1}.0`
            : `${major}.${minor}.${Number(patch) + 1}`
      await tx.dataProduct.update({
        where: { id: cr.productId },
        data: { semanticVersion: bumped },
      })
      await recordAudit(tx, {
        workspaceId: cr.product.workspaceId,
        productId: cr.productId,
        actorId: session.userId,
        action: AUDIT_ACTIONS.PRODUCT_VERSION_BUMPED,
        entityType: 'DataProduct',
        entityId: cr.productId,
        data: { from: cr.product.semanticVersion, to: bumped, changeRequestId: cr.id },
      })
    }

    await recordAudit(tx, {
      workspaceId: cr.product.workspaceId,
      productId: cr.productId,
      actorId: session.userId,
      action: AUDIT_ACTIONS.CHANGE_REQUEST_DISPOSITIONED,
      entityType: 'ChangeRequest',
      entityId: cr.id,
      data: { state, note },
    })
  })

  refresh(cr.productId, 12)
}

const valueSchema = z.object({
  productId: z.string().min(1),
  measuredValue: z.coerce.number(),
  state: z.enum(['REALISED', 'NOT_REALISED', 'NOT_YET_MEASURABLE']),
  note: z.string().trim().default(''),
})

export async function measureValueAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const session = await requireSession()
  const parsed = valueSchema.safeParse({
    productId: formData.get('productId'),
    measuredValue: formData.get('measuredValue'),
    state: formData.get('state'),
    note: formData.get('note'),
  })
  if (!parsed.success) return { error: 'Enter a measured value and a state.' }

  const product = await prisma.dataProduct.findUniqueOrThrow({ where: { id: parsed.data.productId } })
  try {
    await assertRole(
      session.userId,
      product.workspaceId,
      ['DOMAIN_PRODUCT_OWNER', 'PORTFOLIO_LEAD'],
      'Recording a value measurement',
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Not authorised.' }
  }

  const measurement = await prisma.valueMeasurement.findFirst({
    where: { productId: product.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!measurement) return { error: 'No value hypothesis exists for this product.' }

  await prisma.$transaction(async (tx) => {
    await tx.valueMeasurement.update({
      where: { id: measurement.id },
      data: {
        measuredValue: parsed.data.measuredValue,
        state: parsed.data.state,
        measuredAt: new Date(),
        measuredById: session.userId,
        note: parsed.data.note,
      },
    })
    await recordAudit(tx, {
      workspaceId: product.workspaceId,
      productId: product.id,
      actorId: session.userId,
      action: AUDIT_ACTIONS.VALUE_MEASURED,
      entityType: 'ValueMeasurement',
      entityId: measurement.id,
      data: { measuredValue: parsed.data.measuredValue, state: parsed.data.state },
    })
  })

  refresh(product.id, 12)
  revalidatePath('/portfolio')
  return { ok: 'Value measurement recorded against the Stage 2 hypothesis.' }
}
