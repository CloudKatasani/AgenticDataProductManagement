'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { assertRole } from '@/lib/auth/authorise'
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit/log'
import { findNearMatches, type NearMatch } from '@/lib/requests/duplicates'
import { REQUEST_TERMINAL_STATES, type RequestState } from '@/lib/domain/enums'
import { getStage } from '@/lib/lifecycle/stages'
import { ensureStageRun } from '@/lib/lifecycle/transitions'

const intakeSchema = z.object({
  title: z.string().trim().min(5, 'Give the request a short title.'),
  decision: z.string().trim().min(15, 'Describe the decision you cannot make today.'),
  consumerRole: z
    .string()
    .trim()
    .min(3, 'Name a specific role.')
    .refine((v) => !/^the business$/i.test(v), 'Name a specific role, not "the business".'),
  peopleAffected: z.coerce.number().min(1),
  cadence: z.string().trim().min(2, 'How often does this decision recur?'),
  currentWorkaround: z.string().trim().min(5, 'What do you do today instead?'),
  timeTakenToday: z.string().trim().min(2, 'Roughly how long does it take today?'),
  questions: z.array(z.string().trim().min(5)).min(3, 'Give at least three questions.'),
  stakes: z.string().trim().min(15, 'What happens if the decision is not made, or made badly?'),
  quantifiedImpact: z.string().trim().default(''),
  requiredFreshness: z.string().trim().min(2, 'How fresh does the data need to be?'),
  preferredPatternKey: z.string().trim().default(''),
  sensitivityNotes: z.string().trim().default(''),
})

export interface IntakeResult {
  ok?: string
  error?: string
  matches?: NearMatch[]
  requestId?: string
  /** True once near-matches have been shown, so the next submit goes through. */
  checked?: boolean
}

function readQuestions(formData: FormData): string[] {
  return formData
    .getAll('questions')
    .map((q) => String(q).trim())
    .filter(Boolean)
}

export async function submitRequest(
  _prev: IntakeResult | undefined,
  formData: FormData,
): Promise<IntakeResult> {
  const session = await requireSession()
  const parsed = intakeSchema.safeParse({
    title: formData.get('title'),
    decision: formData.get('decision'),
    consumerRole: formData.get('consumerRole'),
    peopleAffected: formData.get('peopleAffected'),
    cadence: formData.get('cadence'),
    currentWorkaround: formData.get('currentWorkaround'),
    timeTakenToday: formData.get('timeTakenToday'),
    questions: readQuestions(formData),
    stakes: formData.get('stakes'),
    quantifiedImpact: formData.get('quantifiedImpact'),
    requiredFreshness: formData.get('requiredFreshness'),
    preferredPatternKey: formData.get('preferredPatternKey'),
    sensitivityNotes: formData.get('sensitivityNotes'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please complete the required answers.' }
  }

  const matches = await findNearMatches({
    workspaceId: session.workspaceId,
    decision: parsed.data.decision,
    consumerRole: parsed.data.consumerRole,
    questions: parsed.data.questions,
  })

  const confirmed = String(formData.get('confirmed') ?? '') === 'true'
  if (matches.length > 0 && !confirmed) {
    return {
      matches,
      checked: true,
      error: `${matches.length} existing product(s) or request(s) may already answer this. Review them before submitting.`,
    }
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } })
  const count = await prisma.productRequest.count({ where: { workspaceId: session.workspaceId } })
  const now = new Date()

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.productRequest.create({
      data: {
        workspaceId: session.workspaceId,
        requesterId: session.userId,
        reference: `REQ-${2000 + count + 1}`,
        title: parsed.data.title,
        state: 'SUBMITTED',
        decision: parsed.data.decision,
        consumerRole: parsed.data.consumerRole,
        peopleAffected: parsed.data.peopleAffected,
        cadence: parsed.data.cadence,
        currentWorkaround: parsed.data.currentWorkaround,
        timeTakenToday: parsed.data.timeTakenToday,
        questionsJson: JSON.stringify(parsed.data.questions),
        stakes: parsed.data.stakes,
        quantifiedImpact: parsed.data.quantifiedImpact,
        requiredFreshness: parsed.data.requiredFreshness,
        preferredPatternKey: parsed.data.preferredPatternKey,
        sensitivityNotes: parsed.data.sensitivityNotes,
        submittedAt: now,
        slaDueAt: new Date(now.getTime() + workspace.triageSlaHours * 3_600_000),
      },
    })
    await tx.task.create({
      data: {
        workspaceId: session.workspaceId,
        requestId: request.id,
        kind: 'TRIAGE',
        title: `Triage ${request.reference} — ${request.title}`,
        detail: parsed.data.decision,
        assigneeRoleKey: 'DOMAIN_PRODUCT_OWNER',
        dueAt: request.slaDueAt,
      },
    })
    await recordAudit(tx, {
      workspaceId: session.workspaceId,
      actorId: session.userId,
      action: AUDIT_ACTIONS.REQUEST_SUBMITTED,
      entityType: 'ProductRequest',
      entityId: request.id,
      data: { reference: request.reference, nearMatches: matches.length },
    })
    return request
  })

  revalidatePath('/request')
  revalidatePath('/inbox')
  return { ok: `Submitted as ${created.reference}. You can follow its status at any time.`, requestId: created.id }
}

const messageSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().trim().min(2, 'Write a reply.'),
})

export async function replyToRequest(
  _prev: { ok?: string; error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession()
  const parsed = messageSchema.safeParse({
    requestId: formData.get('requestId'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Write a reply.' }

  const request = await prisma.productRequest.findUniqueOrThrow({ where: { id: parsed.data.requestId } })
  const isRequester = request.requesterId === session.userId

  await prisma.$transaction(async (tx) => {
    await tx.requestMessage.create({
      data: {
        requestId: request.id,
        authorId: session.userId,
        kind: isRequester ? 'REPLY' : 'NOTE',
        body: parsed.data.body,
      },
    })
    if (isRequester && request.state === 'INFO_REQUESTED') {
      await tx.productRequest.update({ where: { id: request.id }, data: { state: 'IN_TRIAGE' } })
      await recordAudit(tx, {
        workspaceId: request.workspaceId,
        actorId: session.userId,
        action: AUDIT_ACTIONS.REQUEST_INFO_SUPPLIED,
        entityType: 'ProductRequest',
        entityId: request.id,
        data: {},
      })
    }
  })

  revalidatePath(`/request/${request.id}`)
  revalidatePath('/inbox')
  return { ok: 'Reply posted.' }
}

const triageSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(['APPROVE', 'INFO', 'DECLINE', 'MERGE', 'DEFER']),
  note: z.string().trim().default(''),
  domainId: z.string().optional(),
  mergeIntoProductId: z.string().optional(),
})

/**
 * Triage is the only path from a request to a data product. A request never silently becomes a
 * product, and a declined request can never be revived in place — see tests/intake.test.ts.
 */
export async function triageRequest(
  _prev: { ok?: string; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: string; error?: string; productId?: string }> {
  const session = await requireSession()
  const parsed = triageSchema.safeParse({
    requestId: formData.get('requestId'),
    action: formData.get('action'),
    note: formData.get('note'),
    domainId: formData.get('domainId') || undefined,
    mergeIntoProductId: formData.get('mergeIntoProductId') || undefined,
  })
  if (!parsed.success) return { error: 'Choose a triage action.' }

  const request = await prisma.productRequest.findUniqueOrThrow({ where: { id: parsed.data.requestId } })
  try {
    await assertRole(session.userId, request.workspaceId, ['DOMAIN_PRODUCT_OWNER'], 'Triage')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Not authorised.' }
  }

  if (REQUEST_TERMINAL_STATES.includes(request.state as RequestState)) {
    return {
      error: `${request.reference} is already ${request.state}. A terminal request cannot be revived — raise a new one.`,
    }
  }

  if (parsed.data.action === 'DECLINE' && parsed.data.note.length < 10) {
    return { error: 'A decline needs a written reason the requester can read.' }
  }

  if (parsed.data.action === 'APPROVE') {
    if (!parsed.data.domainId) return { error: 'Choose the domain this product belongs to.' }
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id: parsed.data.domainId } })
    const questions = JSON.parse(request.questionsJson) as string[]
    const key = request.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.dataProduct.create({
        data: {
          workspaceId: request.workspaceId,
          domainId: domain.id,
          requestId: request.id,
          key,
          name: request.title,
          description: request.decision,
          ownerId: session.userId,
          status: 'IN_PROGRESS',
          currentStage: 1,
        },
      })
      await tx.productRequest.update({
        where: { id: request.id },
        data: { state: 'APPROVED', triagedAt: new Date(), triagedById: session.userId },
      })
      await tx.task.updateMany({
        where: { requestId: request.id, completedAt: null },
        data: { completedAt: new Date(), completedById: session.userId },
      })
      await recordAudit(tx, {
        workspaceId: request.workspaceId,
        productId: created.id,
        actorId: session.userId,
        action: AUDIT_ACTIONS.REQUEST_APPROVED,
        entityType: 'ProductRequest',
        entityId: request.id,
        data: { productId: created.id, note: parsed.data.note },
      })
      await recordAudit(tx, {
        workspaceId: request.workspaceId,
        productId: created.id,
        actorId: session.userId,
        action: AUDIT_ACTIONS.PRODUCT_CREATED,
        entityType: 'DataProduct',
        entityId: created.id,
        data: {
          fromRequest: request.reference,
          seededQuestions: questions.length,
        },
      })
      return created
    })

    await ensureStageRun(product.id, 1)
    revalidatePath('/inbox')
    revalidatePath('/products')
    return {
      ok: `Approved. ${getStage(1).name} is open with the decision register pre-populated from the request.`,
      productId: product.id,
    }
  }

  const nextState: RequestState =
    parsed.data.action === 'INFO'
      ? 'INFO_REQUESTED'
      : parsed.data.action === 'DECLINE'
        ? 'DECLINED'
        : parsed.data.action === 'MERGE'
          ? 'MERGED'
          : 'DEFERRED'

  await prisma.$transaction(async (tx) => {
    await tx.productRequest.update({
      where: { id: request.id },
      data: {
        state: nextState,
        triagedAt: new Date(),
        triagedById: session.userId,
        declineReason: parsed.data.action === 'DECLINE' ? parsed.data.note : request.declineReason,
        mergedIntoProductId:
          parsed.data.action === 'MERGE' ? (parsed.data.mergeIntoProductId ?? null) : null,
      },
    })
    if (parsed.data.note) {
      await tx.requestMessage.create({
        data: {
          requestId: request.id,
          authorId: session.userId,
          kind: parsed.data.action === 'INFO' ? 'INFO_REQUEST' : 'NOTE',
          body: parsed.data.note,
        },
      })
    }
    if (nextState !== 'INFO_REQUESTED') {
      await tx.task.updateMany({
        where: { requestId: request.id, completedAt: null },
        data: { completedAt: new Date(), completedById: session.userId },
      })
    }
    await recordAudit(tx, {
      workspaceId: request.workspaceId,
      actorId: session.userId,
      action:
        parsed.data.action === 'INFO'
          ? AUDIT_ACTIONS.REQUEST_INFO_REQUESTED
          : parsed.data.action === 'DECLINE'
            ? AUDIT_ACTIONS.REQUEST_DECLINED
            : parsed.data.action === 'MERGE'
              ? AUDIT_ACTIONS.REQUEST_MERGED
              : AUDIT_ACTIONS.REQUEST_DEFERRED,
      entityType: 'ProductRequest',
      entityId: request.id,
      data: { note: parsed.data.note, mergedInto: parsed.data.mergeIntoProductId ?? null },
    })
  })

  revalidatePath('/inbox')
  revalidatePath(`/request/${request.id}`)
  return { ok: `Request moved to ${nextState}.` }
}
