import type { AutonomyLevel } from '@/lib/domain/enums'

/**
 * The model catalogue AS DATA, like every other registry here (stages, agents, patterns, guides).
 * Adding a model must not require editing the runtime.
 *
 * Two things this deliberately is not:
 *
 *  1. **Not a live vendor listing.** These entries are maintained by hand. Nothing calls an API to
 *     discover models, so a model released yesterday will not appear until someone adds it. The
 *     Agents tab says so rather than implying the list is authoritative.
 *  2. **Not a grant of authority.** Assigning a more capable model to a higher autonomy level
 *     changes what an agent is good at, never what it is allowed to do. L3 remains read-only
 *     monitoring whichever model backs it. See AGENT_FORBIDDEN_ACTIONS.
 */

export interface ModelDefinition {
  id: string
  name: string
  vendor: 'anthropic'
  /** Marketing tier, used only for grouping in the UI. */
  tier: 'frontier' | 'balanced' | 'fast'
  contextWindowTokens: number
  /** USD per million tokens. Used for the cost estimate in the action log. */
  pricePerMillionInput: number
  pricePerMillionOutput: number
  /** One sentence on when to reach for it. Shown next to the selector. */
  bestFor: string
  /** Autonomy levels this is a sensible default for. Guidance in the UI, never a restriction. */
  suitedTo: AutonomyLevel[]
}

export const AGENT_MODELS: ModelDefinition[] = [
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    vendor: 'anthropic',
    tier: 'frontier',
    contextWindowTokens: 200_000,
    pricePerMillionInput: 5,
    pricePerMillionOutput: 25,
    bestFor:
      'The hardest reasoning: adversarial critique of a stage against its exit criteria, semantic modelling, certification evidence.',
    suitedTo: ['L2'],
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    vendor: 'anthropic',
    tier: 'balanced',
    contextWindowTokens: 200_000,
    pricePerMillionInput: 3,
    pricePerMillionOutput: 15,
    bestFor:
      'The default working model: drafting artifacts, expanding decision records, proposing attributes and quality rules.',
    suitedTo: ['L1', 'L2'],
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    vendor: 'anthropic',
    tier: 'fast',
    contextWindowTokens: 200_000,
    pricePerMillionInput: 1,
    pricePerMillionOutput: 5,
    bestFor:
      'High-frequency, low-variance work: scheduled freshness and drift monitoring across many published products.',
    suitedTo: ['L3'],
  },
]

export const MODEL_IDS = AGENT_MODELS.map((m) => m.id)

export function getModel(id: string): ModelDefinition | undefined {
  return AGENT_MODELS.find((m) => m.id === id)
}

/**
 * What a level runs on when nobody has chosen. Deliberately not "the best model everywhere":
 * L3 monitors many products on a schedule, so its default is the cheap one, and an admin who
 * wants otherwise has to say so and see the cost.
 */
export const DEFAULT_MODEL_BY_LEVEL: Record<AutonomyLevel, string> = {
  L0: 'claude-haiku-4-5',
  L1: 'claude-sonnet-5',
  L2: 'claude-sonnet-5',
  L3: 'claude-haiku-4-5',
}

export function isKnownModel(id: string): boolean {
  return MODEL_IDS.includes(id)
}
