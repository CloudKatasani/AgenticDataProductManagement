import type { Door } from './enums'

/**
 * The role registry. Veto and approval rights are NOT declared here — they live in the stage
 * registry so that the RACI matrix rendered in Academy is computed from the same data the
 * transition engine enforces, and can never drift from it.
 */

export const ROLE_KEYS = [
  'DATA_CONSUMER',
  'DOMAIN_PRODUCT_OWNER',
  'DATA_STEWARD',
  'DOMAIN_SME',
  'DATA_ARCHITECT',
  'DATA_ENGINEER',
  'PRIVACY_SECURITY_OFFICER',
  'SEMANTIC_STEWARD',
  'GOVERNANCE_COUNCIL',
  'PORTFOLIO_LEAD',
  'ADMIN',
] as const

export type RoleKey = (typeof ROLE_KEYS)[number]

export interface RoleDefinition {
  key: RoleKey
  name: string
  door: Door
  owns: string
  description: string
  sortOrder: number
  seedEmail: string
  seedName: string
}

export const ROLES: RoleDefinition[] = [
  {
    key: 'DATA_CONSUMER',
    name: 'Data Consumer',
    door: 'CONSUMER',
    owns: 'Requests, feedback, ratings, access requests',
    description:
      'A business user, analyst or executive who needs an answer. Enters through the marketplace and never sees a data model.',
    sortOrder: 10,
    seedEmail: 'consumer@adpm.local',
    seedName: 'Nadia Osei',
  },
  {
    key: 'DOMAIN_PRODUCT_OWNER',
    name: 'Domain Product Owner',
    door: 'PRACTITIONER',
    owns: 'Triage, charter, value case, roadmap position',
    description:
      'Accountable for whether a data product should exist at all, what it promises, and whether it returned the value claimed.',
    sortOrder: 20,
    seedEmail: 'owner@adpm.local',
    seedName: 'Marcus Bell',
  },
  {
    key: 'DATA_STEWARD',
    name: 'Data Steward',
    door: 'PRACTITIONER',
    owns: 'Attribute definitions, classification, quality rules, glossary',
    description:
      'Owns what each attribute means, how sensitive it is, and the quality bar it must clear.',
    sortOrder: 30,
    seedEmail: 'steward@adpm.local',
    seedName: 'Priya Raman',
  },
  {
    key: 'DOMAIN_SME',
    name: 'Domain SME',
    door: 'PRACTITIONER',
    owns: 'Business meaning, decision context, source truth, metric semantics',
    description:
      'The person who actually knows how the business works and whether a definition matches reality.',
    sortOrder: 40,
    seedEmail: 'sme@adpm.local',
    seedName: 'Tom Whitfield',
  },
  {
    key: 'DATA_ARCHITECT',
    name: 'Data Architect',
    door: 'PRACTITIONER',
    owns: 'Model, grain, keys, identity resolution, physical architecture',
    description: 'Owns the shape of the data and the honesty of the grain statement.',
    sortOrder: 50,
    seedEmail: 'architect@adpm.local',
    seedName: 'Lena Vogel',
  },
  {
    key: 'DATA_ENGINEER',
    name: 'Data / Platform Engineer',
    door: 'PRACTITIONER',
    owns: 'Ingestion, transformation, orchestration, serving',
    description: 'Builds and runs the pipelines this application designs but never executes.',
    sortOrder: 60,
    seedEmail: 'engineer@adpm.local',
    seedName: 'Sam Okafor',
  },
  {
    key: 'PRIVACY_SECURITY_OFFICER',
    name: 'Privacy & Security Officer',
    door: 'PRACTITIONER',
    owns: 'Classification completeness, access policy, regulatory mapping',
    description:
      'Holds a hard veto at Stage 9. No product reaches consumers without their signature.',
    sortOrder: 70,
    seedEmail: 'privacy@adpm.local',
    seedName: 'Ingrid Halvorsen',
  },
  {
    key: 'SEMANTIC_STEWARD',
    name: 'Semantic Steward',
    door: 'PRACTITIONER',
    owns: 'Certified metrics, name uniqueness, grounding pack integrity',
    description:
      'Guards the commitment that a metric has one definition and one answer in every channel.',
    sortOrder: 80,
    seedEmail: 'semantic@adpm.local',
    seedName: 'Yusuf Demir',
  },
  {
    key: 'GOVERNANCE_COUNCIL',
    name: 'Governance Council',
    door: 'PRACTITIONER',
    owns: 'Certification, publication, retirement',
    description: 'The body that certifies evidence and authorises publication and retirement.',
    sortOrder: 90,
    seedEmail: 'council@adpm.local',
    seedName: 'Dr Amara Nwosu',
  },
  {
    key: 'PORTFOLIO_LEAD',
    name: 'Portfolio Lead / CDO',
    door: 'LEADERSHIP',
    owns: 'Prioritisation, capacity, spend, value realisation',
    description:
      'Answers what we are building, in what order, at what cost, and what the last ten returned.',
    sortOrder: 100,
    seedEmail: 'cdo@adpm.local',
    seedName: 'Helen Cartwright',
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    door: 'ADMIN',
    owns: 'Packs, roles, configuration',
    description: 'Configures packs, role assignment, controls, agent settings and export templates.',
    sortOrder: 110,
    seedEmail: 'admin@adpm.local',
    seedName: 'Ravi Menon',
  },
]

const ROLE_BY_KEY = new Map<string, RoleDefinition>(ROLES.map((r) => [r.key, r]))

export function getRole(key: string): RoleDefinition | undefined {
  return ROLE_BY_KEY.get(key)
}

export function roleName(key: string): string {
  return ROLE_BY_KEY.get(key)?.name ?? key
}

export function isRoleKey(value: string): value is RoleKey {
  return ROLE_BY_KEY.has(value)
}

/** Roles whose default landing page is the practitioner inbox. */
export const PRACTITIONER_ROLES: RoleKey[] = ROLES.filter((r) => r.door === 'PRACTITIONER').map(
  (r) => r.key,
)

/** Roles permitted to triage product requests. */
export const TRIAGE_ROLES: RoleKey[] = ['DOMAIN_PRODUCT_OWNER']

/** Roles permitted to change workspace-level configuration. */
export const ADMIN_ROLES: RoleKey[] = ['ADMIN']
