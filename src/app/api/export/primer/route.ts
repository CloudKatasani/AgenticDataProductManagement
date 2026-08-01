import { NextResponse } from 'next/server'
import { sessionOrNull } from '@/lib/auth/session'
import { PRIMER_SECTIONS, STAGE_GUIDES } from '@/lib/guides/registry'
import { buildPrimerPdf } from '@/lib/exports/pdf'

export async function GET() {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const buffer = await buildPrimerPdf({
    title: 'How data products work here',
    subtitle: `${session.workspaceName} · Agentic Data Product Management · agents act, humans decide`,
    sections: [
      ...PRIMER_SECTIONS,
      {
        title: 'The twelve stages',
        body: STAGE_GUIDES.map((guide) => `${guide.stageNumber}. ${guide.title} — ${guide.plainTerms}`).join(
          '  ',
        ),
      },
      {
        title: 'What this tool deliberately does not do',
        body: 'It does not build pipelines, execute transformations or query a warehouse. No agent can approve a gate, commit a version, publish a product or satisfy an exit criterion. Prioritisation scores are advisory and always overridable by a named human with a recorded reason.',
      },
    ],
    footer: `Generated ${new Date().toISOString().slice(0, 10)} from the live registry — stages, roles and guardrails are read from the same data the engine enforces.`,
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="how-data-products-work-here.pdf"',
    },
  })
}
