/**
 * Capability maturity: five levels across six dimensions. The questionnaire, the level
 * descriptions and the recommended next moves are all data.
 */

export interface MaturityDimension {
  key: string
  name: string
  question: string
  levels: [string, string, string, string, string]
  nextMoves: [string, string, string]
}

export const MATURITY_DIMENSIONS: MaturityDimension[] = [
  {
    key: 'consumption-orientation',
    name: 'Consumption orientation',
    question: 'How reliably does work start from a named consumer and a blocked decision?',
    levels: [
      'Work starts from source systems and platform projects.',
      'Some products name a consumer, usually after the build began.',
      'Most products start from a decision, but the questions are vague.',
      'Every product starts from a named consumer, decision and questions.',
      'Metrics trace to consumer questions automatically, and untraced metrics are rejected.',
    ],
    nextMoves: [
      'Require a named consumer role on every intake, and reject "the business".',
      'Make the decision register a hard block on Stage 2.',
      'Trace every certified metric to a recorded question and report the exceptions.',
    ],
  },
  {
    key: 'lifecycle-discipline',
    name: 'Lifecycle discipline',
    question: 'How consistently do products pass through defined stages and gates?',
    levels: [
      'No defined lifecycle; delivery is ad hoc.',
      'A lifecycle exists on a slide but is not enforced.',
      'Stages are followed for major products only.',
      'Every product passes gates with recorded approvals.',
      'Gate cycle time, rework and first-time pass rate are measured and improving.',
    ],
    nextMoves: [
      'Enforce gates in the tool rather than in the process document.',
      'Measure rework loops per stage and address the worst two.',
      'Publish first-time certification pass rate to the steering committee.',
    ],
  },
  {
    key: 'semantic-consistency',
    name: 'Semantic consistency',
    question: 'How consistently does one metric mean one thing across channels?',
    levels: [
      'Every report defines its own numbers.',
      'A glossary exists but is not enforced anywhere.',
      'A semantic layer exists for some domains.',
      'Certified metrics are unique workspace-wide and enforced at the gate.',
      'Every channel — BI, self-serve, conversational, agentic, API — reads the same definition.',
    ],
    nextMoves: [
      'Enforce workspace-unique metric names at Stage 6.',
      'Migrate the top ten reported metrics into the semantic layer.',
      'Point the conversational and agentic channels at the semantic layer only.',
    ],
  },
  {
    key: 'governance-trust',
    name: 'Governance and trust',
    question: 'Is trust demonstrated with evidence, or asserted with a badge?',
    levels: [
      'No classification or certification.',
      'Classification exists at table level and is often stale.',
      'Attribute-level classification for new products.',
      'Certification cites artifact versions and approvals.',
      'Approvals decay automatically when their evidence changes, and re-approval is tracked.',
    ],
    nextMoves: [
      'Block Stage 9 until every attribute carries a classification.',
      'Require a resolving citation for every certification dimension.',
      'Report stale approvals as a standing governance metric.',
    ],
  },
  {
    key: 'platform-automation',
    name: 'Platform and automation',
    question: 'How much of the mechanical work is automated, and how much is retyped?',
    levels: [
      'Everything is manual and stored in documents.',
      'Some templates exist; lineage is drawn by hand.',
      'Profiling and lineage are generated for new products.',
      'Agents draft, profile, critique and monitor with human disposition.',
      'Agent proposal acceptance rate and time saved are measured and acted on.',
    ],
    nextMoves: [
      'Turn on the Profiling and Definition agents at L1 for one domain.',
      'Generate lineage and ER diagrams rather than drawing them.',
      'Report agent acceptance and edit rates monthly.',
    ],
  },
  {
    key: 'operating-model-adoption',
    name: 'Operating model and adoption',
    question: 'Are roles, prioritisation and value realisation actually operating?',
    levels: [
      'No defined roles; delivery is project-funded and one-off.',
      'Roles named on a slide; prioritisation is by loudest voice.',
      'Roles assigned per domain; a scoring model exists.',
      'Prioritisation is scored, overridable with a reason, and followed.',
      'Value realisation is measured per product and rolled up to the portfolio.',
    ],
    nextMoves: [
      'Assign a named product owner and steward per domain.',
      'Adopt a scoring model and record every override reason.',
      'Measure the Stage 2 hypothesis for every product that reached its measurement date.',
    ],
  },
]

export function maturityLevelLabel(level: number): string {
  return ['Absent', 'Initial', 'Developing', 'Defined', 'Managed', 'Optimising'][level] ?? 'Unknown'
}

export function overallMaturity(scores: Record<string, number>): number {
  const values = MATURITY_DIMENSIONS.map((d) => scores[d.key] ?? 0)
  if (values.length === 0) return 0
  return Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1))
}
