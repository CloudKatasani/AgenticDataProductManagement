import type { Prisma } from '@prisma/client'
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit/log'
import { getStage } from './stages'

/**
 * Cascade honesty (invariant 4): committing a new version of an artifact that an approved gate
 * relied on flips that gate to STALE and raises a re-approval task. Approvals decay when the
 * evidence beneath them changes.
 *
 * A gate is stale when either:
 *   a) its evidence snapshot recorded this artifact at a different content hash, or
 *   b) the artifact belongs to a stage at or before the gate's stage and the snapshot has no
 *      record of it at all — i.e. it appeared after the gate was approved.
 */
export async function invalidateDownstreamGates(
  tx: Prisma.TransactionClient,
  params: {
    workspaceId: string
    productId: string
    artifactId: string
    artifactType: string
    artifactStage: number
    newContentHash: string
    actorId: string | null
    reason: string
  },
): Promise<string[]> {
  const approvedGates = await tx.gate.findMany({
    where: { productId: params.productId, state: 'APPROVED' },
    include: { evidence: true },
  })

  const staled: string[] = []
  for (const gate of approvedGates) {
    const evidence = gate.evidence.find((e) => e.artifactId === params.artifactId)
    const changed = evidence ? evidence.contentHash !== params.newContentHash : false
    const appearedLater = !evidence && gate.stageNumber >= params.artifactStage
    if (!changed && !appearedLater) continue

    await tx.gate.update({
      where: { id: gate.id },
      data: {
        state: 'STALE',
        staleReason: params.reason,
        staleAt: new Date(),
      },
    })
    await tx.task.create({
      data: {
        workspaceId: params.workspaceId,
        productId: params.productId,
        gateId: gate.id,
        kind: 'RE_APPROVAL',
        title: `Re-approve Stage ${gate.stageNumber} — ${getStage(gate.stageNumber).name}`,
        detail: params.reason,
        assigneeRoleKey: getStage(gate.stageNumber).approverRoles[0] ?? null,
      },
    })
    await recordAudit(tx, {
      workspaceId: params.workspaceId,
      productId: params.productId,
      actorId: params.actorId,
      actorType: 'SYSTEM',
      action: AUDIT_ACTIONS.GATE_STALE,
      entityType: 'Gate',
      entityId: gate.id,
      data: {
        stageNumber: gate.stageNumber,
        artifactType: params.artifactType,
        reason: params.reason,
      },
    })
    staled.push(gate.id)
  }
  return staled
}
