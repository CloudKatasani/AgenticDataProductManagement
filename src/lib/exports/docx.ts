import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { MATURITY_DIMENSIONS, maturityLevelLabel, overallMaturity } from '@/lib/portfolio/maturity'

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } })
}

function body(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 100 } })
}

function table(rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, rowIndex) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cell, bold: rowIndex === 0 })],
                  }),
                ],
              }),
          ),
        }),
    ),
  })
}

export interface EvidencePackInput {
  productName: string
  productKey: string
  workspaceName: string
  domainName: string
  ownerName: string
  stewardName: string
  status: string
  semanticVersion: string
  generatedAt: Date
  artifacts: { title: string; type: string; version: number; contentHash: string; committedAt: Date }[]
  approvals: {
    stageNumber: number
    stageName: string
    state: string
    decidedAt: Date | null
    votes: { role: string; user: string; decision: string; rationale: string }[]
  }[]
  scorecard: { dimension: string; score: number; citations: string[]; note: string }[]
  provenance: { human: number; agentAccepted: number; agentEdited: number; agentProposed: number }
  auditEventCount: number
  valueStatement: string
}

/** The signed evidence pack: every artifact version, every approval, every provenance record. */
export async function buildEvidencePack(input: EvidencePackInput): Promise<Buffer> {
  const document = new Document({
    creator: 'Agentic Data Product Management',
    title: `${input.productName} — evidence pack`,
    sections: [
      {
        children: [
          heading(`${input.productName} — evidence pack`, HeadingLevel.TITLE),
          body(
            `${input.workspaceName} · ${input.domainName} · ${input.productKey} · version ${input.semanticVersion} · status ${input.status}`,
          ),
          body(
            `Generated ${input.generatedAt.toISOString()} · owner ${input.ownerName} · steward ${input.stewardName}`,
          ),
          body(
            'This pack is assembled entirely from committed artifact versions and recorded approvals. Nothing in it was typed by hand at export time.',
          ),

          heading('1. Value commitment', HeadingLevel.HEADING_1),
          body(input.valueStatement),

          heading('2. Artifact versions', HeadingLevel.HEADING_1),
          table([
            ['Artifact', 'Version', 'Content hash', 'Committed'],
            ...input.artifacts.map((artifact) => [
              artifact.title,
              `v${artifact.version}`,
              artifact.contentHash.slice(0, 16),
              artifact.committedAt.toISOString(),
            ]),
          ]),

          heading('3. Approvals', HeadingLevel.HEADING_1),
          ...input.approvals.flatMap((approval) => [
            heading(
              `Stage ${approval.stageNumber} — ${approval.stageName} (${approval.state})`,
              HeadingLevel.HEADING_2,
            ),
            body(`Decided ${approval.decidedAt ? approval.decidedAt.toISOString() : 'not decided'}`),
            table([
              ['Role', 'Person', 'Decision', 'Rationale'],
              ...approval.votes.map((vote) => [vote.role, vote.user, vote.decision, vote.rationale || '—']),
            ]),
          ]),

          heading('4. Certification scorecard (DATSIS+V)', HeadingLevel.HEADING_1),
          table([
            ['Dimension', 'Score', 'Citations', 'Note'],
            ...input.scorecard.map((dimension) => [
              dimension.dimension,
              `${dimension.score}/5`,
              dimension.citations.join('; ') || 'NONE',
              dimension.note || '—',
            ]),
          ]),

          heading('5. Human and agent provenance', HeadingLevel.HEADING_1),
          table([
            ['Provenance', 'Fields'],
            ['Human authored', String(input.provenance.human)],
            ['Agent proposed, human accepted', String(input.provenance.agentAccepted)],
            ['Agent proposed, human edited', String(input.provenance.agentEdited)],
            ['Agent proposed, unreviewed', String(input.provenance.agentProposed)],
          ]),
          body(
            'No agent approved a gate, committed a version or published this product. Those paths do not exist in the system.',
          ),

          heading('6. Audit trail', HeadingLevel.HEADING_1),
          body(
            `${input.auditEventCount} append-only audit events cover this product. The full trail is exportable as a signed JSON bundle from Admin.`,
          ),
        ],
      },
    ],
  })
  return Packer.toBuffer(document)
}

export interface MaturityReportInput {
  workspaceName: string
  assessedBy: string
  assessedAt: Date
  scores: Record<string, number>
  notes: Record<string, string>
}

export async function buildMaturityReport(input: MaturityReportInput): Promise<Buffer> {
  const overall = overallMaturity(input.scores)
  const document = new Document({
    creator: 'Agentic Data Product Management',
    title: `${input.workspaceName} — data product capability maturity`,
    sections: [
      {
        children: [
          heading(`${input.workspaceName} — capability maturity`, HeadingLevel.TITLE),
          body(
            `Assessed ${input.assessedAt.toISOString().slice(0, 10)} by ${input.assessedBy} · overall level ${overall} (${maturityLevelLabel(Math.round(overall))})`,
          ),
          body(
            'Five levels across six dimensions. Peer-band comparison is a placeholder in this build: no external benchmark data is bundled, and inventing one would be dishonest.',
          ),
          heading('Dimension detail', HeadingLevel.HEADING_1),
          ...MATURITY_DIMENSIONS.flatMap((dimension) => {
            const level = input.scores[dimension.key] ?? 0
            return [
              heading(`${dimension.name} — level ${level}`, HeadingLevel.HEADING_2),
              body(dimension.question),
              body(`Current: ${dimension.levels[Math.max(0, Math.min(4, level - 1))] ?? 'Not assessed'}`),
              ...(input.notes[dimension.key] ? [body(`Note: ${input.notes[dimension.key]}`)] : []),
              body('Recommended next moves:'),
              ...dimension.nextMoves.map((move) => new Paragraph({ text: move, bullet: { level: 0 } })),
            ]
          }),
        ],
      },
    ],
  })
  return Packer.toBuffer(document)
}
