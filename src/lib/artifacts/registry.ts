import { z } from 'zod'
import {
  archetypeSchema,
  datsisDimensionSchema,
  identityResolutionSchema,
  medallionLayerSchema,
  qualityDimensionSchema,
  sensitivitySchema,
  severitySchema,
  tierSchema,
  valueStateSchema,
} from '@/lib/domain/enums'

/**
 * Artifact schemas. One Zod schema per artifact type, shared by the server action, the form
 * and the exit-criteria evaluators. Adding an artifact type means adding a row here — nothing
 * in the transition engine changes.
 */

export type ArtifactFormat = 'yaml' | 'json' | 'mermaid' | 'markdown'

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`)

// ── Stage 1 ────────────────────────────────────────────────────────────────────────────────
export const decisionRecordSchema = z.object({
  id: nonEmpty('Record id'),
  consumerPersona: nonEmpty('Consumer persona'),
  decision: nonEmpty('Decision blocked today'),
  cadence: nonEmpty('Cadence'),
  currentWorkaround: nonEmpty('Current workaround'),
  latencyTolerance: nonEmpty('Latency tolerance'),
  consequence: nonEmpty('Consequence of not deciding'),
  questions: z.array(nonEmpty('Question')).min(3, 'At least three questions are required'),
})
export type DecisionRecord = z.infer<typeof decisionRecordSchema>

export const decisionRegisterSchema = z.object({
  decisions: z.array(decisionRecordSchema).min(1, 'At least one decision record is required'),
})
export type DecisionRegister = z.infer<typeof decisionRegisterSchema>

// ── Stage 2 ────────────────────────────────────────────────────────────────────────────────
export const charterSchema = z.object({
  purpose: nonEmpty('Purpose'),
  archetype: archetypeSchema,
  tier: tierSchema,
  inScope: z.array(nonEmpty('In-scope item')).min(1, 'Declare at least one in-scope item'),
  outOfScope: z
    .array(nonEmpty('Out-of-scope item'))
    .min(1, 'An explicit out-of-scope list is required'),
  targetPatterns: z.array(z.string()).min(1, 'Name at least one target consumption pattern'),
  stakeholders: z.array(z.object({ role: nonEmpty('Role'), name: z.string().default('') })),
})
export type Charter = z.infer<typeof charterSchema>

export const valueCaseSchema = z.object({
  hypothesis: z.object({
    statement: nonEmpty('Hypothesis statement'),
    baseline: z.number(),
    baselineUnit: nonEmpty('Baseline unit'),
    expectedChange: z.number(),
    expectedChangeDirection: z.enum(['INCREASE', 'DECREASE']),
    measurementMethod: nonEmpty('Measurement method'),
    measurementDate: nonEmpty('Measurement date'),
  }),
  buildEffortDays: z.number().min(0).default(0),
  runCostPerYearUsd: z.number().min(0).default(0),
  benefits: z.array(
    z.object({
      description: nonEmpty('Benefit description'),
      annualValueUsd: z.number().min(0).default(0),
    }),
  ),
})
export type ValueCase = z.infer<typeof valueCaseSchema>

// ── Stage 3 ────────────────────────────────────────────────────────────────────────────────
export const sourceInventorySchema = z.object({
  sources: z
    .array(
      z.object({
        name: nonEmpty('Source name'),
        system: nonEmpty('System'),
        systemOfRecord: z.boolean().default(false),
        owner: nonEmpty('Owner'),
        refreshCadence: nonEmpty('Refresh cadence'),
        accessMethod: nonEmpty('Access method'),
        notes: z.string().default(''),
      }),
    )
    .min(1, 'At least one source is required'),
})
export type SourceInventory = z.infer<typeof sourceInventorySchema>

export const profileColumnSchema = z.object({
  name: nonEmpty('Column'),
  datatype: z.string().default('string'),
  rowCount: z.number().min(0).default(0),
  nullRate: z.number().min(0).max(1).default(0),
  distinctCount: z.number().min(0).default(0),
  min: z.string().default(''),
  max: z.string().default(''),
  pattern: z.string().default(''),
  sample: z.string().default(''),
})

export const profileReportSchema = z.object({
  profiledAt: z.string().default(''),
  datasets: z
    .array(
      z.object({
        source: nonEmpty('Source'),
        rowCount: z.number().min(0).default(0),
        columns: z.array(profileColumnSchema).min(1, 'Profile at least one column'),
      }),
    )
    .min(1, 'At least one profiled dataset is required'),
})
export type ProfileReport = z.infer<typeof profileReportSchema>

export const gapLogSchema = z.object({
  gaps: z.array(
    z.object({
      id: nonEmpty('Gap id'),
      source: z.string().default(''),
      description: nonEmpty('Description'),
      severity: severitySchema,
      mitigation: z.string().default(''),
      owner: z.string().default(''),
    }),
  ),
})
export type GapLog = z.infer<typeof gapLogSchema>

// ── Stage 4 ────────────────────────────────────────────────────────────────────────────────
export const logicalModelSchema = z.object({
  grainStatement: nonEmpty('Grain statement'),
  entities: z
    .array(
      z.object({
        name: nonEmpty('Entity name'),
        description: z.string().default(''),
        primaryKey: z.array(nonEmpty('Key column')).min(1, 'Every entity needs a primary key'),
        attributes: z.array(z.string()).default([]),
      }),
    )
    .min(1, 'At least one entity is required'),
  relationships: z.array(
    z.object({
      from: nonEmpty('From entity'),
      to: nonEmpty('To entity'),
      cardinality: z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY']),
      via: z.string().default(''),
    }),
  ),
  backboneBindings: z.array(
    z.object({ entity: nonEmpty('Entity'), backboneEntity: nonEmpty('Backbone entity') }),
  ),
  identityResolution: z.object({
    method: identityResolutionSchema,
    justification: nonEmpty('Identity resolution justification'),
  }),
})
export type LogicalModel = z.infer<typeof logicalModelSchema>

export const diagramSchema = z.object({
  diagram: nonEmpty('Diagram source'),
  generatedFrom: z.string().default(''),
})
export type Diagram = z.infer<typeof diagramSchema>

// ── Stage 5 ────────────────────────────────────────────────────────────────────────────────
export const attributeSchema = z.object({
  name: nonEmpty('Attribute name'),
  entity: nonEmpty('Entity'),
  businessDefinition: nonEmpty('Business definition'),
  sourceLineage: nonEmpty('Source lineage'),
  datatype: nonEmpty('Datatype'),
  nullable: z.boolean().default(true),
  allowedValues: z.string().default(''),
  sensitivity: sensitivitySchema,
  pii: z.boolean().default(false),
  regulatoryFlags: z.array(z.string()).default([]),
  derivation: z.string().default(''),
  steward: z.string().default(''),
  patternExposure: z.array(z.string()).default([]),
})
export type AttributeDefinition = z.infer<typeof attributeSchema>

export const attributeRegisterSchema = z.object({
  attributes: z.array(attributeSchema).min(1, 'At least one attribute is required'),
  parkingLot: z
    .array(z.object({ item: nonEmpty('Item'), raisedBy: z.string().default('') }))
    .default([]),
})
export type AttributeRegister = z.infer<typeof attributeRegisterSchema>

export const dataContractSchema = z.object({
  schemaColumns: z
    .array(
      z.object({
        name: nonEmpty('Column'),
        datatype: nonEmpty('Datatype'),
        nullable: z.boolean().default(true),
        description: z.string().default(''),
      }),
    )
    .min(1, 'The contract must describe at least one column'),
  slas: z.object({
    freshnessMinutes: z.number().min(0),
    availabilityPct: z.number().min(0).max(100),
    maxNullRatePct: z.number().min(0).max(100),
  }),
  versioning: z.object({
    policy: nonEmpty('Versioning policy'),
    deprecationNoticeDays: z.number().min(0),
  }),
  support: z.object({ owner: nonEmpty('Contract owner'), channel: z.string().default('') }),
})
export type DataContract = z.infer<typeof dataContractSchema>

// ── Stage 6 ────────────────────────────────────────────────────────────────────────────────
export const metricSchema = z.object({
  name: nonEmpty('Metric name'),
  label: nonEmpty('Metric label'),
  definition: nonEmpty('Metric definition'),
  expression: nonEmpty('Metric expression'),
  grain: nonEmpty('Metric grain'),
  tracesToQuestions: z
    .array(z.string())
    .min(1, 'Every metric must trace to at least one Stage 1 question'),
  owner: z.string().default(''),
})
export type MetricDefinition = z.infer<typeof metricSchema>

export const semanticModelSchema = z.object({
  entities: z
    .array(
      z.object({
        name: nonEmpty('Entity'),
        primaryEntity: z.boolean().default(false),
        description: z.string().default(''),
      }),
    )
    .min(1, 'At least one semantic entity is required'),
  dimensions: z.array(
    z.object({
      name: nonEmpty('Dimension'),
      type: z.enum(['CATEGORICAL', 'TIME']),
      expression: z.string().default(''),
    }),
  ),
  joins: z.array(
    z.object({ from: nonEmpty('From'), to: nonEmpty('To'), on: nonEmpty('Join condition') }),
  ),
  metrics: z.array(metricSchema).min(1, 'At least one certified metric is required'),
})
export type SemanticModel = z.infer<typeof semanticModelSchema>

// ── Stage 7 ────────────────────────────────────────────────────────────────────────────────
export const physicalArchitectureSchema = z.object({
  platformProfile: nonEmpty('Platform profile'),
  ingestionPattern: nonEmpty('Ingestion pattern'),
  orchestration: nonEmpty('Orchestration'),
  schedule: nonEmpty('Schedule'),
  refreshStrategy: nonEmpty('Refresh strategy'),
  layers: z.object({
    bronze: z.array(z.string()).default([]),
    silver: z.array(z.string()).default([]),
    gold: z.array(z.string()).default([]),
  }),
  attributeLayerMap: z
    .array(z.object({ attribute: nonEmpty('Attribute'), layer: medallionLayerSchema }))
    .default([]),
})
export type PhysicalArchitecture = z.infer<typeof physicalArchitectureSchema>

// ── Stage 8 ────────────────────────────────────────────────────────────────────────────────
export const qualityRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        id: nonEmpty('Rule id'),
        attribute: nonEmpty('Attribute'),
        dimension: qualityDimensionSchema,
        expression: nonEmpty('Rule expression'),
        threshold: z.number(),
        unit: z.string().default('%'),
        severity: severitySchema,
        alertRoute: nonEmpty('Alert route'),
      }),
    )
    .min(1, 'At least one quality rule is required'),
  freshnessTargetMinutes: z.number().min(0),
  maxNullRatePct: z.number().min(0).max(100),
})
export type QualityRules = z.infer<typeof qualityRulesSchema>

export const runbookSchema = z.object({
  markdown: z.string().trim().min(40, 'The runbook needs real remediation content'),
  onCallRole: nonEmpty('On-call role'),
})
export type Runbook = z.infer<typeof runbookSchema>

// ── Stage 9 ────────────────────────────────────────────────────────────────────────────────
export const accessPolicySchema = z.object({
  model: z.enum(['ABAC', 'RBAC_PLUS_PURPOSE']),
  policies: z
    .array(
      z.object({
        name: nonEmpty('Policy name'),
        purpose: nonEmpty('Purpose'),
        subjects: z.array(nonEmpty('Subject')).min(1, 'Name at least one subject'),
        condition: z.string().default(''),
        effect: z.enum(['ALLOW', 'DENY']),
      }),
    )
    .min(1, 'At least one access policy is required'),
  masking: z.array(
    z.object({ attribute: nonEmpty('Attribute'), rule: nonEmpty('Masking rule') }),
  ),
  rowLevel: z.array(
    z.object({ name: nonEmpty('Rule name'), predicate: nonEmpty('Predicate') }),
  ),
  retention: z.object({
    period: nonEmpty('Retention period'),
    basis: nonEmpty('Retention basis'),
  }),
  residency: nonEmpty('Data residency'),
})
export type AccessPolicy = z.infer<typeof accessPolicySchema>

export const regulatoryMapSchema = z.object({
  mappings: z
    .array(
      z.object({
        controlKey: nonEmpty('Control key'),
        requirement: nonEmpty('Requirement'),
        attributes: z.array(z.string()).default([]),
        evidence: nonEmpty('Evidence'),
      }),
    )
    .min(1, 'Map at least one regulatory control'),
})
export type RegulatoryMap = z.infer<typeof regulatoryMapSchema>

// ── Stage 10 ───────────────────────────────────────────────────────────────────────────────
export const servingSpecSchema = z.object({
  biBinding: z.object({
    tool: nonEmpty('BI tool'),
    semanticSource: nonEmpty('Semantic source'),
    rowLevelSecurity: z.boolean().default(true),
  }),
  api: z.object({
    basePath: nonEmpty('API base path'),
    endpoints: z
      .array(
        z.object({
          path: nonEmpty('Path'),
          method: z.enum(['GET', 'POST']),
          description: z.string().default(''),
        }),
      )
      .min(1, 'Describe at least one endpoint'),
    rateLimitPerMinute: z.number().min(1),
  }),
  supportedPatterns: z.array(z.string()).min(1, 'Declare at least one supported pattern'),
  costToServeUsdPerMonth: z.number().min(0).default(0),
})
export type ServingSpec = z.infer<typeof servingSpecSchema>

export const marketplaceListingSchema = z.object({
  headline: nonEmpty('Headline'),
  description: nonEmpty('Description'),
  owner: nonEmpty('Owner'),
  steward: nonEmpty('Steward'),
  domain: nonEmpty('Domain'),
  lineageSummary: nonEmpty('Lineage summary'),
  qualityScore: z.number().min(0).max(100),
  freshness: nonEmpty('Freshness'),
  accessTier: z.enum(['OPEN', 'REQUEST', 'RESTRICTED']),
  costToServeUsdPerMonth: z.number().min(0).default(0),
  sampleQuestions: z.array(z.string()).default([]),
  sampleQueries: z.array(z.string()).default([]),
  supportedPatterns: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
})
export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>

export const groundingPackSchema = z.object({
  sampleQuestions: z.array(nonEmpty('Question')).min(3, 'Provide at least three sample questions'),
  glossaryTerms: z.array(
    z.object({ term: nonEmpty('Term'), definition: nonEmpty('Definition') }),
  ),
  metricDefinitions: z
    .array(z.object({ name: nonEmpty('Metric'), definition: nonEmpty('Definition') }))
    .min(1, 'A grounding pack without metric definitions cannot ground anything'),
  allowedJoins: z.array(z.string()).default([]),
  disambiguationHints: z.array(z.string()).default([]),
  refusalGuidance: z
    .array(nonEmpty('Refusal rule'))
    .min(1, 'State at least one refusal rule for the model'),
  objectReferences: z
    .array(
      z.object({
        object: nonEmpty('Object'),
        layer: z.enum(['GOLD', 'SEMANTIC', 'BRONZE', 'SILVER']),
      }),
    )
    .default([]),
})
export type GroundingPack = z.infer<typeof groundingPackSchema>

// ── Stage 11 ───────────────────────────────────────────────────────────────────────────────
export const citationSchema = z.object({
  kind: z.enum(['ARTIFACT_VERSION', 'APPROVAL']),
  ref: nonEmpty('Citation reference'),
  detail: z.string().default(''),
})

export const certificationScorecardSchema = z.object({
  dimensions: z
    .array(
      z.object({
        dimension: datsisDimensionSchema,
        score: z.number().min(0).max(5),
        citations: z.array(citationSchema),
        note: z.string().default(''),
      }),
    )
    .min(7, 'All seven DATSIS+V dimensions must be scored'),
  certifiedBy: z.string().default(''),
})
export type CertificationScorecard = z.infer<typeof certificationScorecardSchema>

// ── Stage 12 ───────────────────────────────────────────────────────────────────────────────
export const telemetrySchema = z.object({
  consumers: z.number().min(0).default(0),
  queries30d: z.number().min(0).default(0),
  sessions30d: z.number().min(0).default(0),
  lastUsedAt: z.string().default(''),
  patternUsage: z
    .array(z.object({ patternKey: nonEmpty('Pattern'), uses30d: z.number().min(0) }))
    .default([]),
  schemaDriftDetected: z.boolean().default(false),
  freshnessBreaches30d: z.number().min(0).default(0),
})
export type Telemetry = z.infer<typeof telemetrySchema>

export const feedbackLogSchema = z.object({
  entries: z
    .array(
      z.object({
        consumer: nonEmpty('Consumer'),
        rating: z.number().min(1).max(5),
        comment: z.string().default(''),
        receivedAt: z.string().default(''),
      }),
    )
    .default([]),
})
export type FeedbackLog = z.infer<typeof feedbackLogSchema>

export const changeRequestsArtifactSchema = z.object({
  entries: z
    .array(
      z.object({
        id: nonEmpty('Change request id'),
        title: nonEmpty('Title'),
        state: z.string().default('OPEN'),
        versionBump: z.string().default('PATCH'),
      }),
    )
    .default([]),
})
export type ChangeRequestsArtifact = z.infer<typeof changeRequestsArtifactSchema>

export const benefitRealisationSchema = z.object({
  hypothesisStatement: nonEmpty('Hypothesis under measurement'),
  baseline: z.number(),
  measuredValue: z.number(),
  unit: nonEmpty('Unit'),
  measuredAt: nonEmpty('Measurement date'),
  state: valueStateSchema,
  evidence: nonEmpty('Evidence'),
})
export type BenefitRealisation = z.infer<typeof benefitRealisationSchema>

// ── Registry ───────────────────────────────────────────────────────────────────────────────

export interface ArtifactTypeDefinition {
  key: string
  fileName: string
  format: ArtifactFormat
  stage: number
  title: string
  description: string
  schema: z.ZodType
  /** Content that satisfies the type but not necessarily the exit criteria. */
  empty: () => unknown
}

export const ARTIFACT_TYPES: ArtifactTypeDefinition[] = [
  {
    key: 'decision-register',
    fileName: 'decision-register.yaml',
    format: 'yaml',
    stage: 1,
    title: 'Decision register',
    description:
      'Who is blocked, on what decision, how often, and the questions they would ask if they had the data.',
    schema: decisionRegisterSchema,
    empty: () => ({ decisions: [] }),
  },
  {
    key: 'charter',
    fileName: 'charter.yaml',
    format: 'yaml',
    stage: 2,
    title: 'Charter',
    description: 'Archetype, tier, scope boundary with an explicit out-of-scope list.',
    schema: charterSchema,
    empty: () => ({
      purpose: '',
      archetype: 'ENTITY_MASTER',
      tier: 'CONSUMER_ALIGNED',
      inScope: [],
      outOfScope: [],
      targetPatterns: [],
      stakeholders: [],
    }),
  },
  {
    key: 'value-case',
    fileName: 'value-case.yaml',
    format: 'yaml',
    stage: 2,
    title: 'Value case',
    description: 'A measurable hypothesis: baseline, expected change, method, measurement date.',
    schema: valueCaseSchema,
    empty: () => ({
      hypothesis: {
        statement: '',
        baseline: 0,
        baselineUnit: '',
        expectedChange: 0,
        expectedChangeDirection: 'DECREASE',
        measurementMethod: '',
        measurementDate: '',
      },
      buildEffortDays: 0,
      runCostPerYearUsd: 0,
      benefits: [],
    }),
  },
  {
    key: 'source-inventory',
    fileName: 'source-inventory.yaml',
    format: 'yaml',
    stage: 3,
    title: 'Source inventory',
    description: 'Candidate sources and which one is the system of record.',
    schema: sourceInventorySchema,
    empty: () => ({ sources: [] }),
  },
  {
    key: 'profile-report',
    fileName: 'profile-report.json',
    format: 'json',
    stage: 3,
    title: 'Profile report',
    description: 'Row counts, null rates, cardinality and patterns — from CSV upload or entry.',
    schema: profileReportSchema,
    empty: () => ({ profiledAt: '', datasets: [] }),
  },
  {
    key: 'gap-log',
    fileName: 'gap-log.yaml',
    format: 'yaml',
    stage: 3,
    title: 'Gap log',
    description: 'What the sources cannot answer, how severe it is, and who owns the mitigation.',
    schema: gapLogSchema,
    empty: () => ({ gaps: [] }),
  },
  {
    key: 'logical-model',
    fileName: 'logical-model.yaml',
    format: 'yaml',
    stage: 4,
    title: 'Logical model',
    description: 'Entities, relationships, an explicit grain statement and identity resolution.',
    schema: logicalModelSchema,
    empty: () => ({
      grainStatement: '',
      entities: [],
      relationships: [],
      backboneBindings: [],
      identityResolution: { method: 'DETERMINISTIC', justification: '' },
    }),
  },
  {
    key: 'er-diagram',
    fileName: 'er.mermaid',
    format: 'mermaid',
    stage: 4,
    title: 'ER diagram',
    description: 'Mermaid ER diagram generated from the logical model.',
    schema: diagramSchema,
    empty: () => ({ diagram: '', generatedFrom: 'logical-model' }),
  },
  {
    key: 'attribute-register',
    fileName: 'attribute-register.yaml',
    format: 'yaml',
    stage: 5,
    title: 'Attribute register',
    description:
      'The workhorse: definition, lineage, datatype, sensitivity, PII and steward per attribute.',
    schema: attributeRegisterSchema,
    empty: () => ({ attributes: [], parkingLot: [] }),
  },
  {
    key: 'data-contract',
    fileName: 'data-contract.yaml',
    format: 'yaml',
    stage: 5,
    title: 'Data contract',
    description: 'Schema, SLAs, quality thresholds, versioning and deprecation policy.',
    schema: dataContractSchema,
    empty: () => ({
      schemaColumns: [],
      slas: { freshnessMinutes: 1440, availabilityPct: 99, maxNullRatePct: 2 },
      versioning: { policy: 'Semantic versioning', deprecationNoticeDays: 90 },
      support: { owner: '', channel: '' },
    }),
  },
  {
    key: 'semantic-model',
    fileName: 'semantic-model.yaml',
    format: 'yaml',
    stage: 6,
    title: 'Semantic model',
    description: 'Entities, dimensions, joins and certified metrics traced to Stage 1 questions.',
    schema: semanticModelSchema,
    empty: () => ({ entities: [], dimensions: [], joins: [], metrics: [] }),
  },
  {
    key: 'physical-architecture',
    fileName: 'physical-architecture.yaml',
    format: 'yaml',
    stage: 7,
    title: 'Physical architecture',
    description: 'Medallion mapping, ingestion, orchestration and refresh strategy.',
    schema: physicalArchitectureSchema,
    empty: () => ({
      platformProfile: '',
      ingestionPattern: '',
      orchestration: '',
      schedule: '',
      refreshStrategy: '',
      layers: { bronze: [], silver: [], gold: [] },
      attributeLayerMap: [],
    }),
  },
  {
    key: 'lineage-diagram',
    fileName: 'lineage.mermaid',
    format: 'mermaid',
    stage: 7,
    title: 'Lineage diagram',
    description: 'Mermaid lineage generated from sources and medallion layers.',
    schema: diagramSchema,
    empty: () => ({ diagram: '', generatedFrom: 'physical-architecture' }),
  },
  {
    key: 'quality-rules',
    fileName: 'quality-rules.yaml',
    format: 'yaml',
    stage: 8,
    title: 'Quality rules',
    description: 'Rules bound to attributes across the six quality dimensions, with alert routing.',
    schema: qualityRulesSchema,
    empty: () => ({ rules: [], freshnessTargetMinutes: 1440, maxNullRatePct: 2 }),
  },
  {
    key: 'runbook',
    fileName: 'runbook.md',
    format: 'markdown',
    stage: 8,
    title: 'Remediation runbook',
    description: 'What an on-call engineer does when a rule breaches.',
    schema: runbookSchema,
    empty: () => ({ markdown: '', onCallRole: '' }),
  },
  {
    key: 'access-policy',
    fileName: 'access-policy.yaml',
    format: 'yaml',
    stage: 9,
    title: 'Access policy',
    description: 'ABAC and purpose-based policies, masking, row-level rules, retention, residency.',
    schema: accessPolicySchema,
    empty: () => ({
      model: 'ABAC',
      policies: [],
      masking: [],
      rowLevel: [],
      retention: { period: '', basis: '' },
      residency: '',
    }),
  },
  {
    key: 'regulatory-map',
    fileName: 'regulatory-map.yaml',
    format: 'yaml',
    stage: 9,
    title: 'Regulatory map',
    description: 'Attributes and processing mapped to the pack control library.',
    schema: regulatoryMapSchema,
    empty: () => ({ mappings: [] }),
  },
  {
    key: 'serving-spec',
    fileName: 'serving-spec.yaml',
    format: 'yaml',
    stage: 10,
    title: 'Serving specification',
    description: 'BI binding, API specification, supported patterns and cost to serve.',
    schema: servingSpecSchema,
    empty: () => ({
      biBinding: { tool: '', semanticSource: '', rowLevelSecurity: true },
      api: { basePath: '', endpoints: [], rateLimitPerMinute: 60 },
      supportedPatterns: [],
      costToServeUsdPerMonth: 0,
    }),
  },
  {
    key: 'marketplace-listing',
    fileName: 'marketplace-listing.json',
    format: 'json',
    stage: 10,
    title: 'Marketplace listing',
    description: 'Everything a consumer sees before requesting access.',
    schema: marketplaceListingSchema,
    empty: () => ({
      headline: '',
      description: '',
      owner: '',
      steward: '',
      domain: '',
      lineageSummary: '',
      qualityScore: 0,
      freshness: '',
      accessTier: 'REQUEST',
      costToServeUsdPerMonth: 0,
      sampleQuestions: [],
      sampleQueries: [],
      supportedPatterns: [],
      entities: [],
    }),
  },
  {
    key: 'grounding-pack',
    fileName: 'grounding-pack.json',
    format: 'json',
    stage: 10,
    title: 'Grounding pack',
    description: 'What makes the product safely usable by an LLM or an agent.',
    schema: groundingPackSchema,
    empty: () => ({
      sampleQuestions: [],
      glossaryTerms: [],
      metricDefinitions: [],
      allowedJoins: [],
      disambiguationHints: [],
      refusalGuidance: [],
      objectReferences: [],
    }),
  },
  {
    key: 'certification-scorecard',
    fileName: 'certification-scorecard.yaml',
    format: 'yaml',
    stage: 11,
    title: 'Certification scorecard',
    description: 'DATSIS+V scored against cited artifact versions and approvals.',
    schema: certificationScorecardSchema,
    empty: () => ({ dimensions: [], certifiedBy: '' }),
  },
  {
    key: 'telemetry',
    fileName: 'telemetry.json',
    format: 'json',
    stage: 12,
    title: 'Telemetry',
    description: 'Usage, pattern coverage, freshness breaches and schema drift.',
    schema: telemetrySchema,
    empty: () => ({
      consumers: 0,
      queries30d: 0,
      sessions30d: 0,
      lastUsedAt: '',
      patternUsage: [],
      schemaDriftDetected: false,
      freshnessBreaches30d: 0,
    }),
  },
  {
    key: 'feedback-log',
    fileName: 'feedback-log.yaml',
    format: 'yaml',
    stage: 12,
    title: 'Feedback log',
    description: 'What consumers actually said.',
    schema: feedbackLogSchema,
    empty: () => ({ entries: [] }),
  },
  {
    key: 'change-requests',
    fileName: 'change-requests.yaml',
    format: 'yaml',
    stage: 12,
    title: 'Change requests',
    description: 'Requested changes and the version bump each implies.',
    schema: changeRequestsArtifactSchema,
    empty: () => ({ entries: [] }),
  },
  {
    key: 'benefit-realisation',
    fileName: 'benefit-realisation.yaml',
    format: 'yaml',
    stage: 12,
    title: 'Benefit realisation',
    description: 'The Stage 2 hypothesis measured, honestly, against what actually happened.',
    schema: benefitRealisationSchema,
    empty: () => ({
      hypothesisStatement: '',
      baseline: 0,
      measuredValue: 0,
      unit: '',
      measuredAt: '',
      state: 'NOT_YET_MEASURABLE',
      evidence: '',
    }),
  },
]

const BY_KEY = new Map(ARTIFACT_TYPES.map((a) => [a.key, a]))

export function getArtifactType(key: string): ArtifactTypeDefinition {
  const def = BY_KEY.get(key)
  if (!def) throw new Error(`Unknown artifact type: ${key}`)
  return def
}

export function artifactTypesForStage(stage: number): ArtifactTypeDefinition[] {
  return ARTIFACT_TYPES.filter((a) => a.stage === stage)
}

export function artifactTitle(key: string): string {
  return BY_KEY.get(key)?.title ?? key
}
