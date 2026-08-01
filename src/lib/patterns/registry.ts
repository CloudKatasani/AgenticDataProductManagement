/**
 * The eight consumption patterns AS DATA. A pattern's readiness is computed from the artifacts
 * it requires — adding a pattern never touches the transition engine.
 */

export interface ConsumptionPattern {
  key: string
  name: string
  description: string
  consumerPersona: string
  latencyProfile: string
  freshnessProfile: string
  /** Artifact types that must be committed and whose stage gate must be approved. */
  requiredArtifacts: string[]
  /** Stage that must be approved before this pattern may be offered at all. */
  minimumApprovedStage: number
  interfaceContract: string
  guardrails: string[]
  antiPatterns: string[]
  readinessChecklist: string[]
}

export const CONSUMPTION_PATTERNS: ConsumptionPattern[] = [
  {
    key: 'certified-dashboard',
    name: 'Certified dashboard (BI)',
    description:
      'A governed dashboard built on the semantic layer, where the numbers on screen are the certified metrics and nothing else.',
    consumerPersona: 'Executive, manager',
    latencyProfile: 'Seconds to render; data as fresh as the contract promises',
    freshnessProfile: 'Batch, typically daily or intraday',
    requiredArtifacts: ['semantic-model', 'serving-spec', 'access-policy'],
    minimumApprovedStage: 10,
    interfaceContract: 'BI tool bound to the semantic model with row-level security applied.',
    guardrails: [
      'The dashboard may only surface certified metrics from the semantic model.',
      'Row-level security is applied at the semantic layer, not in the dashboard filter.',
    ],
    antiPatterns: [
      'Recreating metric logic inside the BI tool.',
      'A dashboard built directly on a Silver table because "it was quicker".',
    ],
    readinessChecklist: [
      'Semantic model approved',
      'BI binding declared in the serving specification',
      'Row-level security rules defined in the access policy',
    ],
  },
  {
    key: 'self-serve-exploration',
    name: 'Self-serve exploration',
    description:
      'Analysts explore the certified model themselves, with a clear line between certified objects and their own sandbox.',
    consumerPersona: 'Analyst',
    latencyProfile: 'Interactive query',
    freshnessProfile: 'As per contract',
    requiredArtifacts: ['semantic-model', 'data-contract', 'access-policy'],
    minimumApprovedStage: 10,
    interfaceContract: 'Query access to certified semantic objects plus a separate sandbox schema.',
    guardrails: [
      'Certified and sandbox objects are separated and visibly labelled.',
      'Query cost guardrails are enforced by the platform, not by convention.',
    ],
    antiPatterns: [
      'Sandbox output presented to executives as certified.',
      'Unbounded scans against the gold layer with no cost ceiling.',
    ],
    readinessChecklist: [
      'Semantic model approved',
      'Contract published with SLAs',
      'Sandbox separation described in the serving specification',
    ],
  },
  {
    key: 'conversational',
    name: 'Conversational (natural language to answer)',
    description:
      'A business user asks a question in plain language and receives an answer grounded in certified metrics.',
    consumerPersona: 'Any business user',
    latencyProfile: 'Seconds',
    freshnessProfile: 'As per contract',
    requiredArtifacts: ['grounding-pack', 'semantic-model'],
    minimumApprovedStage: 10,
    interfaceContract: 'Grounding pack supplied to the language model; answers cite the metric used.',
    guardrails: [
      'Only certified metrics and semantic objects may be referenced.',
      'The grounding pack must state when the model should refuse.',
      'No free-form text-to-SQL against raw tables, ever.',
    ],
    antiPatterns: [
      'Pointing the model at the warehouse and hoping.',
      'Answering out-of-scope questions rather than refusing.',
    ],
    readinessChecklist: [
      'Grounding pack committed and free of Bronze or Silver references',
      'Every grounded metric is certified',
      'Refusal guidance written',
    ],
  },
  {
    key: 'agentic-tool-calling',
    name: 'Agentic / tool-calling',
    description:
      'An autonomous agent calls the product as a tool, with declared functions and mandatory source citation.',
    consumerPersona: 'Autonomous agent',
    latencyProfile: 'Sub-second to seconds',
    freshnessProfile: 'As per contract',
    requiredArtifacts: ['grounding-pack', 'serving-spec', 'access-policy'],
    minimumApprovedStage: 10,
    interfaceContract: 'Function-calling specification with allowed joins and citation requirements.',
    guardrails: [
      'Allowed joins are declared; anything else is refused.',
      'Every answer carries a source citation.',
      'The agent inherits the consumer access policy — it does not bypass it.',
    ],
    antiPatterns: [
      'An agent with broader data access than the human it acts for.',
      'Tool responses with no provenance.',
    ],
    readinessChecklist: [
      'Grounding pack approved',
      'API or function specification declared',
      'Access policy covers machine consumers',
    ],
  },
  {
    key: 'api-embedded',
    name: 'API / embedded application',
    description: 'A product engineer embeds the data in an operational application.',
    consumerPersona: 'Product engineer',
    latencyProfile: 'Milliseconds to seconds',
    freshnessProfile: 'Near-real-time to batch',
    requiredArtifacts: ['serving-spec', 'data-contract'],
    minimumApprovedStage: 10,
    interfaceContract: 'Versioned REST endpoints with rate and cost limits.',
    guardrails: [
      'Contract versioning is semantic, and deprecation carries notice.',
      'Rate and cost limits are declared, not discovered in production.',
    ],
    antiPatterns: ['Breaking schema changes shipped without a major version bump.'],
    readinessChecklist: [
      'Endpoint specification declared',
      'Contract versioning policy stated',
      'Rate limit set',
    ],
  },
  {
    key: 'bulk-extract',
    name: 'Bulk extract / file',
    description: 'A scheduled file delivered to a downstream system or a regulator.',
    consumerPersona: 'Downstream system, regulator',
    latencyProfile: 'Scheduled',
    freshnessProfile: 'Daily to monthly',
    requiredArtifacts: ['data-contract', 'access-policy'],
    minimumApprovedStage: 9,
    interfaceContract: 'Contract-defined file, schedule, delivery mechanism and retention policy.',
    guardrails: [
      'Delivery and retention are governed by the access policy.',
      'Regulatory extracts cite the control they satisfy.',
    ],
    antiPatterns: ['Ad-hoc CSVs emailed outside the governed channel.'],
    readinessChecklist: [
      'Contract approved',
      'Schedule and delivery mechanism declared',
      'Retention and residency stated',
    ],
  },
  {
    key: 'ml-feature',
    name: 'ML feature consumption',
    description: 'A data scientist consumes attributes as features with point-in-time correctness.',
    consumerPersona: 'Data scientist',
    latencyProfile: 'Batch training, low-latency serving',
    freshnessProfile: 'Training and serving parity required',
    requiredArtifacts: ['attribute-register', 'physical-architecture', 'data-contract'],
    minimumApprovedStage: 8,
    interfaceContract: 'Feature definitions with point-in-time semantics and training/serving parity.',
    guardrails: [
      'Point-in-time correctness is stated per feature.',
      'Training and serving read the same definition.',
    ],
    antiPatterns: ['Label leakage from an attribute computed after the event.'],
    readinessChecklist: [
      'Attribute register approved',
      'Physical architecture declares the serving path',
      'Contract states freshness for serving',
    ],
  },
  {
    key: 'operational-activation',
    name: 'Operational activation',
    description:
      'The product drives an operational system — CRM, contact centre, field operations — where a wrong value has a customer consequence.',
    consumerPersona: 'CRM, contact centre, field operations',
    latencyProfile: 'Near-real-time',
    freshnessProfile: 'Minutes',
    requiredArtifacts: ['data-contract', 'access-policy', 'quality-rules'],
    minimumApprovedStage: 9,
    interfaceContract: 'Governed write-back and activation with consent enforcement.',
    guardrails: [
      'Consent is enforced at activation time, not assumed at design time.',
      'Write-back is governed and audited.',
      'Freshness SLA is monitored, because staleness reaches a customer directly.',
    ],
    antiPatterns: ['Activating on data whose consent basis was never checked.'],
    readinessChecklist: [
      'Freshness rule monitored',
      'Consent condition present in the access policy',
      'Write-back governance stated',
    ],
  },
]

const BY_KEY = new Map(CONSUMPTION_PATTERNS.map((p) => [p.key, p]))

export function getPattern(key: string): ConsumptionPattern | undefined {
  return BY_KEY.get(key)
}

export function patternName(key: string): string {
  return BY_KEY.get(key)?.name ?? key
}

export const PATTERN_KEYS = CONSUMPTION_PATTERNS.map((p) => p.key)

export type PatternReadiness = 'READY' | 'DRAFTED' | 'ABSENT'

export interface PatternReadinessResult {
  patternKey: string
  readiness: PatternReadiness
  requirements: { artifactType: string; state: PatternReadiness }[]
  blockedReason: string
}

/**
 * Green where the required artifact exists and its stage gate is approved, amber where it is
 * committed but not yet approved, red where it is absent.
 */
export function evaluatePatternReadiness(
  pattern: ConsumptionPattern,
  committedArtifacts: Set<string>,
  approvedStages: number[],
  artifactStage: (artifactType: string) => number,
): PatternReadinessResult {
  const requirements = pattern.requiredArtifacts.map((artifactType) => {
    if (!committedArtifacts.has(artifactType)) {
      return { artifactType, state: 'ABSENT' as const }
    }
    return {
      artifactType,
      state: approvedStages.includes(artifactStage(artifactType))
        ? ('READY' as const)
        : ('DRAFTED' as const),
    }
  })

  const stageGateMet = approvedStages.includes(pattern.minimumApprovedStage)
  let readiness: PatternReadiness = 'READY'
  if (requirements.some((r) => r.state === 'ABSENT')) readiness = 'ABSENT'
  else if (requirements.some((r) => r.state === 'DRAFTED') || !stageGateMet) readiness = 'DRAFTED'

  const blockedReason =
    readiness === 'READY'
      ? ''
      : !stageGateMet
        ? `Stage ${pattern.minimumApprovedStage} must be approved before this pattern can be offered.`
        : `Waiting on: ${requirements
            .filter((r) => r.state !== 'READY')
            .map((r) => r.artifactType)
            .join(', ')}.`

  return { patternKey: pattern.key, readiness, requirements, blockedReason }
}
