import { z } from 'zod'

/**
 * SQLite has no native enum type, so every enumerated column is a String whose permitted
 * values live here and are validated by Zod at the boundary. One definition, one place.
 */

export const REQUEST_STATES = [
  'DRAFT',
  'SUBMITTED',
  'IN_TRIAGE',
  'INFO_REQUESTED',
  'APPROVED',
  'DECLINED',
  'MERGED',
  'DEFERRED',
] as const
export const requestStateSchema = z.enum(REQUEST_STATES)
export type RequestState = (typeof REQUEST_STATES)[number]

export const REQUEST_TERMINAL_STATES: RequestState[] = ['APPROVED', 'DECLINED', 'MERGED']

export const PRODUCT_STATUSES = [
  'IN_PROGRESS',
  'CERTIFIED',
  'PUBLISHED',
  'DEPRECATED',
  'RETIRED',
] as const
export const productStatusSchema = z.enum(PRODUCT_STATUSES)
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const ARCHETYPES = [
  'ENTITY_MASTER',
  'EVENT_STREAM',
  'METRIC_KPI',
  'FEATURE_STORE',
  'REFERENCE_DATA',
  'INSIGHT_RECOMMENDATION',
] as const
export const archetypeSchema = z.enum(ARCHETYPES)
export type Archetype = (typeof ARCHETYPES)[number]

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  ENTITY_MASTER: 'Entity Master',
  EVENT_STREAM: 'Event Stream',
  METRIC_KPI: 'Metric / KPI',
  FEATURE_STORE: 'Feature Store',
  REFERENCE_DATA: 'Reference Data',
  INSIGHT_RECOMMENDATION: 'Insight / Recommendation',
}

export const TIERS = ['SOURCE_ALIGNED', 'AGGREGATE', 'CONSUMER_ALIGNED'] as const
export const tierSchema = z.enum(TIERS)
export type Tier = (typeof TIERS)[number]

export const TIER_LABELS: Record<Tier, string> = {
  SOURCE_ALIGNED: 'Source-aligned',
  AGGREGATE: 'Aggregate',
  CONSUMER_ALIGNED: 'Consumer-aligned',
}

export const STAGE_RUN_STATES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'GATE_OPEN',
  'APPROVED',
  'REJECTED',
] as const
export const stageRunStateSchema = z.enum(STAGE_RUN_STATES)
export type StageRunState = (typeof STAGE_RUN_STATES)[number]

export const GATE_STATES = ['PENDING', 'OPEN', 'APPROVED', 'REJECTED', 'STALE'] as const
export const gateStateSchema = z.enum(GATE_STATES)
export type GateState = (typeof GATE_STATES)[number]

export const DECISIONS = ['APPROVE', 'REJECT', 'ABSTAIN'] as const
export const decisionSchema = z.enum(DECISIONS)
export type Decision = (typeof DECISIONS)[number]

export const PROVENANCE = ['HUMAN', 'AGENT_PROPOSED', 'AGENT_ACCEPTED', 'AGENT_EDITED'] as const
export const provenanceSchema = z.enum(PROVENANCE)
export type Provenance = (typeof PROVENANCE)[number]

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  HUMAN: 'Human authored',
  AGENT_PROPOSED: 'Agent proposed — not yet reviewed',
  AGENT_ACCEPTED: 'Agent proposed, human accepted',
  AGENT_EDITED: 'Agent proposed, human edited and accepted',
}

export const AUTONOMY_LEVELS = ['L0', 'L1', 'L2', 'L3'] as const
export const autonomyLevelSchema = z.enum(AUTONOMY_LEVELS)
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

export const AUTONOMY_LABELS: Record<AutonomyLevel, { name: string; behaviour: string }> = {
  L0: { name: 'Off', behaviour: 'Agent never runs.' },
  L1: {
    name: 'Suggest',
    behaviour: 'Runs only when invoked; proposes field by field; a human dispositions each field.',
  },
  L2: {
    name: 'Draft',
    behaviour:
      'Runs on a stage-entry trigger; produces a whole-artifact draft; a human reviews it as a unit.',
  },
  L3: {
    name: 'Monitor',
    behaviour:
      'Runs on a schedule against published products; raises findings, tasks and change requests. Never edits an artifact.',
  },
}

export const AGENT_DISPOSITIONS = ['PENDING', 'ACCEPTED', 'EDITED', 'REJECTED'] as const
export const agentDispositionSchema = z.enum(AGENT_DISPOSITIONS)
export type AgentDisposition = (typeof AGENT_DISPOSITIONS)[number]

export const PROPOSAL_STATES = ['PENDING', 'ACCEPTED', 'EDITED', 'REJECTED'] as const
export const proposalStateSchema = z.enum(PROPOSAL_STATES)
export type ProposalState = (typeof PROPOSAL_STATES)[number]

export const COMMENT_KINDS = ['REVIEW', 'AGENT_CRITIC', 'NOTE', 'PARKING_LOT'] as const
export const commentKindSchema = z.enum(COMMENT_KINDS)
export type CommentKind = (typeof COMMENT_KINDS)[number]

export const TASK_KINDS = [
  'GATE_APPROVAL',
  'RE_APPROVAL',
  'TRIAGE',
  'INFO_REQUEST',
  'VALUE_MEASUREMENT',
  'AGENT_DISPOSITION',
  'CHANGE_REQUEST',
] as const
export const taskKindSchema = z.enum(TASK_KINDS)
export type TaskKind = (typeof TASK_KINDS)[number]

export const ACTOR_TYPES = ['HUMAN', 'AGENT', 'SYSTEM'] as const
export const actorTypeSchema = z.enum(ACTOR_TYPES)
export type ActorType = (typeof ACTOR_TYPES)[number]

export const SENSITIVITY = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
export const sensitivitySchema = z.enum(SENSITIVITY)
export type Sensitivity = (typeof SENSITIVITY)[number]

export const MEDALLION_LAYERS = ['BRONZE', 'SILVER', 'GOLD'] as const
export const medallionLayerSchema = z.enum(MEDALLION_LAYERS)
export type MedallionLayer = (typeof MEDALLION_LAYERS)[number]

export const CHANGE_REQUEST_STATES = ['OPEN', 'ACCEPTED', 'REJECTED', 'DONE'] as const
export const changeRequestStateSchema = z.enum(CHANGE_REQUEST_STATES)
export type ChangeRequestState = (typeof CHANGE_REQUEST_STATES)[number]

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export const severitySchema = z.enum(SEVERITIES)
export type Severity = (typeof SEVERITIES)[number]

export const VERSION_BUMPS = ['PATCH', 'MINOR', 'MAJOR'] as const
export const versionBumpSchema = z.enum(VERSION_BUMPS)
export type VersionBump = (typeof VERSION_BUMPS)[number]

export const VALUE_STATES = ['REALISED', 'NOT_REALISED', 'NOT_YET_MEASURABLE'] as const
export const valueStateSchema = z.enum(VALUE_STATES)
export type ValueState = (typeof VALUE_STATES)[number]

export const ACCESS_REQUEST_STATES = ['PENDING', 'APPROVED', 'DENIED'] as const
export const accessRequestStateSchema = z.enum(ACCESS_REQUEST_STATES)
export type AccessRequestState = (typeof ACCESS_REQUEST_STATES)[number]

export const IDENTITY_RESOLUTION_METHODS = ['DETERMINISTIC', 'PROBABILISTIC', 'HYBRID'] as const
export const identityResolutionSchema = z.enum(IDENTITY_RESOLUTION_METHODS)
export type IdentityResolutionMethod = (typeof IDENTITY_RESOLUTION_METHODS)[number]

export const QUALITY_DIMENSIONS = [
  'FRESHNESS',
  'COMPLETENESS',
  'VALIDITY',
  'UNIQUENESS',
  'CONSISTENCY',
  'TIMELINESS',
] as const
export const qualityDimensionSchema = z.enum(QUALITY_DIMENSIONS)
export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number]

export const DATSIS_DIMENSIONS = [
  'DISCOVERABLE',
  'ADDRESSABLE',
  'TRUSTWORTHY',
  'SELF_DESCRIBING',
  'INTEROPERABLE',
  'SECURE',
  'VALUABLE',
] as const
export const datsisDimensionSchema = z.enum(DATSIS_DIMENSIONS)
export type DatsisDimension = (typeof DATSIS_DIMENSIONS)[number]

export const DATSIS_LABELS: Record<DatsisDimension, string> = {
  DISCOVERABLE: 'Discoverable',
  ADDRESSABLE: 'Addressable',
  TRUSTWORTHY: 'Trustworthy',
  SELF_DESCRIBING: 'Self-describing',
  INTEROPERABLE: 'Interoperable',
  SECURE: 'Secure',
  VALUABLE: 'Valuable',
}

export const DOORS = ['CONSUMER', 'PRACTITIONER', 'LEADERSHIP', 'ADMIN'] as const
export const doorSchema = z.enum(DOORS)
export type Door = (typeof DOORS)[number]
