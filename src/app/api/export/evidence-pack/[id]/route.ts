import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sessionOrNull } from '@/lib/auth/session'
import { buildEvidencePack } from '@/lib/exports/docx'
import { certificationScorecardSchema, valueCaseSchema, getArtifactType } from '@/lib/artifacts/registry'
import { getStage } from '@/lib/lifecycle/stages'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await context.params

  const product = await prisma.dataProduct.findUnique({
    where: { id },
    include: {
      owner: true,
      steward: true,
      domain: true,
      workspace: true,
      artifacts: { include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { provenance: true } } } },
      gates: { include: { approvals: { include: { user: true } } }, orderBy: { stageNumber: 'asc' } },
    },
  })
  if (!product || product.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: 'Not found in this workspace.' }, { status: 404 })
  }

  const provenance = { human: 0, agentAccepted: 0, agentEdited: 0, agentProposed: 0 }
  const artifacts = product.artifacts
    .map((artifact) => {
      const version = artifact.versions[0]
      if (!version) return undefined
      for (const entry of version.provenance) {
        if (entry.provenance === 'AGENT_ACCEPTED') provenance.agentAccepted += 1
        else if (entry.provenance === 'AGENT_EDITED') provenance.agentEdited += 1
        else if (entry.provenance === 'AGENT_PROPOSED') provenance.agentProposed += 1
        else provenance.human += 1
      }
      return {
        title: getArtifactType(artifact.type).title,
        type: artifact.type,
        version: version.version,
        contentHash: version.contentHash,
        committedAt: version.createdAt,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)

  const scorecardArtifact = product.artifacts.find((a) => a.type === 'certification-scorecard')
  const scorecardVersion = scorecardArtifact?.versions[0]
  const scorecard = scorecardVersion
    ? certificationScorecardSchema.safeParse(JSON.parse(scorecardVersion.contentJson))
    : undefined

  const valueArtifact = product.artifacts.find((a) => a.type === 'value-case')
  const valueVersion = valueArtifact?.versions[0]
  const valueCase = valueVersion ? valueCaseSchema.safeParse(JSON.parse(valueVersion.contentJson)) : undefined

  const auditEventCount = await prisma.auditEvent.count({ where: { productId: id } })

  const buffer = await buildEvidencePack({
    productName: product.name,
    productKey: product.key,
    workspaceName: product.workspace.name,
    domainName: product.domain.name,
    ownerName: product.owner.name,
    stewardName: product.steward?.name ?? 'Unassigned',
    status: product.status,
    semanticVersion: product.semanticVersion,
    generatedAt: new Date(),
    artifacts,
    approvals: product.gates.map((gate) => ({
      stageNumber: gate.stageNumber,
      stageName: getStage(gate.stageNumber).name,
      state: gate.state,
      decidedAt: gate.decidedAt,
      votes: gate.approvals.map((approval) => ({
        role: approval.roleKey,
        user: approval.user.name,
        decision: approval.decision,
        rationale: approval.rationale,
      })),
    })),
    scorecard:
      scorecard?.success
        ? scorecard.data.dimensions.map((dimension) => ({
            dimension: dimension.dimension,
            score: dimension.score,
            citations: dimension.citations.map((citation) => citation.ref),
            note: dimension.note,
          }))
        : [],
    provenance,
    auditEventCount,
    valueStatement: valueCase?.success
      ? `${valueCase.data.hypothesis.statement} — baseline ${valueCase.data.hypothesis.baseline} ${valueCase.data.hypothesis.baselineUnit}, expected change ${valueCase.data.hypothesis.expectedChange}, measured by ${valueCase.data.hypothesis.measurementMethod} on ${valueCase.data.hypothesis.measurementDate}.`
      : 'No value case committed.',
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${product.key}-evidence-pack.docx"`,
    },
  })
}
