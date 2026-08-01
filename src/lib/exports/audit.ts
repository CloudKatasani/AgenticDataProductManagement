import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { canonicalise } from '@/lib/hash'

/**
 * The full audit export for external assurance: every gate, decision, artifact version and agent
 * action in one bundle, with a digest over the canonical payload so tampering is detectable.
 *
 * "Signed" here means digest-sealed with SHA-256 over canonical JSON. It is not a cryptographic
 * signature by an external key holder, and the bundle says so rather than implying otherwise.
 */
export async function buildAuditBundle(workspaceId: string) {
  const [workspace, products, gates, approvals, versions, agentActions, events, requests] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
      prisma.dataProduct.findMany({ where: { workspaceId }, include: { domain: true } }),
      prisma.gate.findMany({ where: { product: { workspaceId } }, include: { evidence: true } }),
      prisma.approval.findMany({
        where: { gate: { product: { workspaceId } } },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.artifactVersion.findMany({
        where: { artifact: { product: { workspaceId } } },
        include: { artifact: true, provenance: true, createdBy: { select: { email: true } } },
      }),
      prisma.agentAction.findMany({ where: { workspaceId } }),
      prisma.auditEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
      prisma.productRequest.findMany({ where: { workspaceId } }),
    ])

  const payload = {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, packKey: workspace.packKey },
    generatedAt: new Date().toISOString(),
    counts: {
      products: products.length,
      gates: gates.length,
      approvals: approvals.length,
      artifactVersions: versions.length,
      agentActions: agentActions.length,
      auditEvents: events.length,
      requests: requests.length,
    },
    products: products.map((product) => ({
      id: product.id,
      key: product.key,
      name: product.name,
      domain: product.domain.name,
      status: product.status,
      semanticVersion: product.semanticVersion,
      publishedAt: product.publishedAt,
    })),
    gates: gates.map((gate) => ({
      id: gate.id,
      productId: gate.productId,
      stageNumber: gate.stageNumber,
      state: gate.state,
      quorum: gate.quorum,
      requiredRoles: gate.requiredRoles,
      vetoRoles: gate.vetoRoles,
      decidedAt: gate.decidedAt,
      staleReason: gate.staleReason,
      evidence: gate.evidence.map((evidence) => ({
        artifactId: evidence.artifactId,
        artifactVersionId: evidence.artifactVersionId,
        contentHash: evidence.contentHash,
      })),
    })),
    approvals: approvals.map((approval) => ({
      gateId: approval.gateId,
      roleKey: approval.roleKey,
      decision: approval.decision,
      rationale: approval.rationale,
      by: approval.user.email,
      at: approval.createdAt,
    })),
    artifactVersions: versions.map((version) => ({
      id: version.id,
      artifactType: version.artifact.type,
      productId: version.artifact.productId,
      version: version.version,
      contentHash: version.contentHash,
      createdBy: version.createdBy.email,
      createdAt: version.createdAt,
      provenance: version.provenance.map((entry) => ({
        fieldPath: entry.fieldPath,
        provenance: entry.provenance,
        agentId: entry.agentId,
      })),
    })),
    agentActions: agentActions.map((action) => ({
      id: action.id,
      agentId: action.agentId,
      productId: action.productId,
      stageNumber: action.stageNumber,
      trigger: action.trigger,
      scope: JSON.parse(action.scopeJson) as string[],
      inputHash: action.inputHash,
      model: action.model,
      promptTokens: action.promptTokens,
      completionTokens: action.completionTokens,
      estimatedCostUsd: action.estimatedCostUsd,
      disposition: action.disposition,
      initiatedById: action.initiatedById,
      createdAt: action.createdAt,
    })),
    auditEvents: events.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      actorType: event.actorType,
      productId: event.productId,
      data: JSON.parse(event.dataJson) as unknown,
      createdAt: event.createdAt,
    })),
  }

  const digest = createHash('sha256').update(JSON.stringify(canonicalise(payload))).digest('hex')

  return {
    bundle: {
      seal: {
        algorithm: 'sha256',
        digest,
        note: 'Digest-sealed over canonical JSON. This is a tamper-evidence digest, not a cryptographic signature by an external key holder.',
      },
      ...payload,
    },
    digest,
  }
}
