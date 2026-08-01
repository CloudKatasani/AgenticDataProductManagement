import type { Prisma } from '@prisma/client'
import type { ActorType } from '@/lib/domain/enums'

export interface AuditInput {
  workspaceId: string
  productId?: string | null
  actorId?: string | null
  actorType?: ActorType
  action: string
  entityType: string
  entityId: string
  data?: Record<string, unknown>
}

/**
 * Append-only. There is deliberately no update or delete helper for AuditEvent anywhere in
 * this codebase — see tests/audit-immutability.test.ts.
 */
export async function recordAudit(tx: Prisma.TransactionClient, input: AuditInput): Promise<void> {
  await tx.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      productId: input.productId ?? null,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? 'HUMAN',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      dataJson: JSON.stringify(input.data ?? {}),
    },
  })
}

export const AUDIT_ACTIONS = {
  REQUEST_SUBMITTED: 'request.submitted',
  REQUEST_TRIAGE_STARTED: 'request.triage_started',
  REQUEST_INFO_REQUESTED: 'request.info_requested',
  REQUEST_INFO_SUPPLIED: 'request.info_supplied',
  REQUEST_APPROVED: 'request.approved',
  REQUEST_DECLINED: 'request.declined',
  REQUEST_MERGED: 'request.merged',
  REQUEST_DEFERRED: 'request.deferred',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_PUBLISHED: 'product.published',
  PRODUCT_RETIRED: 'product.retired',
  PRODUCT_DEPRECATED: 'product.deprecated',
  PRODUCT_VERSION_BUMPED: 'product.version_bumped',
  ARTIFACT_COMMITTED: 'artifact.committed',
  STAGE_SUBMITTED: 'stage.submitted_for_review',
  STAGE_CHANGES_REQUESTED: 'stage.changes_requested',
  STAGE_WITHDRAWN: 'stage.withdrawn_to_draft',
  GATE_OPENED: 'gate.opened',
  GATE_DECISION_RECORDED: 'gate.decision_recorded',
  GATE_APPROVED: 'gate.approved',
  GATE_REJECTED: 'gate.rejected',
  GATE_STALE: 'gate.marked_stale',
  AGENT_INVOKED: 'agent.invoked',
  AGENT_PROPOSAL_DISPOSITIONED: 'agent.proposal_dispositioned',
  AGENT_SETTINGS_CHANGED: 'agent.settings_changed',
  AGENT_MODEL_ASSIGNED: 'agent.model_assigned',
  COMMENT_ADDED: 'comment.added',
  COMMENT_RESOLVED: 'comment.resolved',
  ACCESS_REQUESTED: 'access.requested',
  ACCESS_DECIDED: 'access.decided',
  CHANGE_REQUEST_RAISED: 'change_request.raised',
  CHANGE_REQUEST_DISPOSITIONED: 'change_request.dispositioned',
  VALUE_MEASURED: 'value.measured',
  PRIORITISATION_OVERRIDDEN: 'portfolio.prioritisation_overridden',
  MATURITY_ASSESSED: 'portfolio.maturity_assessed',
  FEEDBACK_SUBMITTED: 'feedback.submitted',
} as const
