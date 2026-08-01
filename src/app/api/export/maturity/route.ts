import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sessionOrNull } from '@/lib/auth/session'
import { buildMaturityReport } from '@/lib/exports/docx'

export async function GET() {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const assessment = await prisma.maturityAssessment.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true, workspace: true },
  })
  if (!assessment) {
    return NextResponse.json(
      { error: 'No maturity assessment has been recorded for this workspace yet.' },
      { status: 409 },
    )
  }

  const buffer = await buildMaturityReport({
    workspaceName: assessment.workspace.name,
    assessedBy: assessment.createdBy.name,
    assessedAt: assessment.createdAt,
    scores: JSON.parse(assessment.scoresJson) as Record<string, number>,
    notes: JSON.parse(assessment.notesJson) as Record<string, string>,
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${session.workspaceSlug}-maturity.docx"`,
    },
  })
}
