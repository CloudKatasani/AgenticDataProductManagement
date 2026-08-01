import type { z } from 'zod'

/**
 * Exit criteria are pure functions over a StageContext. They never touch the database, so
 * they are trivially testable and identical whether evaluated for the UI checklist or by the
 * transition engine at gate-open time.
 */

export interface ArtifactSnapshot {
  type: string
  version: number
  content: unknown
  contentHash: string
  committedAt: Date
  /** True when any field in this version is still recorded as unreviewed agent output. */
  hasUnreviewedAgentFields: boolean
}

export interface StageContext {
  stageNumber: number
  product: {
    id: string
    key: string
    name: string
    workspaceId: string
    archetype: string
    tier: string
    status: string
  }
  /** Committed artifacts for this product, keyed by artifact type. */
  artifacts: Record<string, ArtifactSnapshot | undefined>
  /** Agent proposals for this stage that no human has dispositioned. */
  pendingProposals: number
  /** Review comments on this stage that are unresolved and not parking-lot items. */
  unresolvedComments: number
  /** Certified metric names owned by *other* products in the workspace. */
  otherProductMetricNames: { metric: string; productKey: string }[]
  /** Stage numbers whose gate is currently APPROVED. */
  approvedStages: number[]
  /** Citation targets that exist: `artifact:<type>@v<n>` and `approval:stage-<n>`. */
  evidenceRefs: string[]
  /** Control keys supplied by the workspace pack. */
  packControlKeys: string[]
  /** Consumption pattern keys known to the registry. */
  patternKeys: string[]
}

export interface CriterionResult {
  key: string
  label: string
  passed: boolean
  detail: string
  /** A blocking criterion prevents the gate from opening. Advisory ones are shown but do not block. */
  blocking: boolean
}

export function criterion(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  blocking = true,
): CriterionResult {
  return { key, label, passed, detail, blocking }
}

export function snapshot(ctx: StageContext, type: string): ArtifactSnapshot | undefined {
  return ctx.artifacts[type]
}

/** Parse a committed artifact's content, returning undefined when absent or invalid. */
export function parseArtifact<T>(
  ctx: StageContext,
  type: string,
  schema: z.ZodType<T>,
): T | undefined {
  const snap = ctx.artifacts[type]
  if (!snap) return undefined
  const parsed = schema.safeParse(snap.content)
  return parsed.success ? parsed.data : undefined
}

/** Every stage carries these two criteria; they are the structural half of invariant 5. */
export function universalCriteria(ctx: StageContext, requiredArtifacts: string[]): CriterionResult[] {
  const missing = requiredArtifacts.filter((type) => !ctx.artifacts[type])
  const unreviewed = requiredArtifacts.filter((type) => ctx.artifacts[type]?.hasUnreviewedAgentFields)

  return [
    criterion(
      'artifacts-committed',
      'Every required artifact for this stage is committed',
      missing.length === 0,
      missing.length === 0
        ? `${requiredArtifacts.length} artifact(s) committed.`
        : `Not yet committed: ${missing.join(', ')}.`,
    ),
    criterion(
      'no-unreviewed-agent-fields',
      'No field is still unreviewed agent output',
      unreviewed.length === 0 && ctx.pendingProposals === 0,
      unreviewed.length === 0 && ctx.pendingProposals === 0
        ? 'All agent proposals have been accepted, edited or rejected by a human.'
        : `${ctx.pendingProposals} proposal(s) awaiting human disposition${
            unreviewed.length ? `; unreviewed content in ${unreviewed.join(', ')}` : ''
          }.`,
    ),
  ]
}

/** Advisory: unresolved review comments do not block a gate, but the reviewer should see them. */
export function commentsCriterion(ctx: StageContext): CriterionResult {
  return criterion(
    'comments-resolved',
    'Review comments resolved',
    ctx.unresolvedComments === 0,
    ctx.unresolvedComments === 0
      ? 'No unresolved review comments.'
      : `${ctx.unresolvedComments} unresolved review comment(s).`,
    false,
  )
}

export function allBlockingPassed(results: CriterionResult[]): boolean {
  return results.filter((r) => r.blocking).every((r) => r.passed)
}

export function failedBlocking(results: CriterionResult[]): CriterionResult[] {
  return results.filter((r) => r.blocking && !r.passed)
}

/** Loose containment test used to trace metrics back to Stage 1 questions. */
export function referencesQuestion(reference: string, questions: string[]): boolean {
  const needle = reference.trim().toLowerCase()
  if (!needle) return false
  return questions.some((q) => {
    const hay = q.trim().toLowerCase()
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}
