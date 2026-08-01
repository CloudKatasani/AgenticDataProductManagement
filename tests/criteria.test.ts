import { describe, expect, it } from 'vitest'
import { getStage } from '@/lib/lifecycle/stages'
import { allBlockingPassed, type StageContext } from '@/lib/lifecycle/criteria'
import { PATTERN_KEYS } from '@/lib/patterns/registry'

function context(overrides: Partial<StageContext> = {}): StageContext {
  return {
    stageNumber: 1,
    product: {
      id: 'p1',
      key: 'p1',
      name: 'Test',
      workspaceId: 'w1',
      archetype: 'ENTITY_MASTER',
      tier: 'CONSUMER_ALIGNED',
      status: 'IN_PROGRESS',
    },
    artifacts: {},
    pendingProposals: 0,
    unresolvedComments: 0,
    otherProductMetricNames: [],
    approvedStages: [],
    evidenceRefs: [],
    packControlKeys: [],
    patternKeys: [...PATTERN_KEYS],
    ...overrides,
  }
}

function snapshot(type: string, content: unknown, unreviewed = false) {
  return {
    type,
    version: 1,
    content,
    contentHash: 'hash',
    committedAt: new Date(),
    hasUnreviewedAgentFields: unreviewed,
  }
}

describe('Stage 1 — consumption first', () => {
  it('fails with no decision register', () => {
    const results = getStage(1).exitCriteria(context())
    expect(allBlockingPassed(results)).toBe(false)
  })

  it('rejects "the business" as a consumer persona', () => {
    const register = {
      decisions: [
        {
          id: 'DR-1',
          consumerPersona: 'The business',
          decision: 'Decide something',
          cadence: 'Weekly',
          currentWorkaround: 'A spreadsheet',
          latencyTolerance: 'Daily',
          consequence: 'Bad things',
          questions: ['a?', 'b?', 'c?'],
        },
      ],
    }
    const results = getStage(1).exitCriteria(
      context({ artifacts: { 'decision-register': snapshot('decision-register', register) } }),
    )
    const named = results.find((r) => r.key === 'named-persona')
    expect(named?.passed).toBe(false)
  })

  it('blocks submission while a field is still unreviewed agent output', () => {
    const register = {
      decisions: [
        {
          id: 'DR-1',
          consumerPersona: 'Collections Manager',
          decision: 'Which accounts to contact',
          cadence: 'Weekly',
          currentWorkaround: 'A spreadsheet',
          latencyTolerance: 'Daily',
          consequence: 'Recoverable arrears age',
          questions: ['a question?', 'b question?', 'c question?'],
        },
      ],
    }
    const results = getStage(1).exitCriteria(
      context({
        artifacts: { 'decision-register': snapshot('decision-register', register, true) },
        pendingProposals: 2,
      }),
    )
    const provenance = results.find((r) => r.key === 'no-unreviewed-agent-fields')
    expect(provenance?.passed).toBe(false)
    expect(allBlockingPassed(results)).toBe(false)
  })
})

describe('Stage 2 — hard block on Stage 1', () => {
  it('cannot pass until Stage 1 is approved', () => {
    const results = getStage(2).exitCriteria(context({ stageNumber: 2 }))
    expect(results.find((r) => r.key === 'stage-1-approved')?.passed).toBe(false)
  })
})

describe('Stage 6 — metric traceability and uniqueness', () => {
  const register = {
    decisions: [
      {
        id: 'DR-1',
        consumerPersona: 'Analyst',
        decision: 'Which accounts to contact',
        cadence: 'Weekly',
        currentWorkaround: 'A spreadsheet',
        latencyTolerance: 'Daily',
        consequence: 'Arrears age',
        questions: ['Which accounts crossed 60 days in arrears this week?', 'b question?', 'c question?'],
      },
    ],
  }
  const model = (metricName: string, tracesTo: string[]) => ({
    entities: [{ name: 'Account', primaryEntity: true, description: '' }],
    dimensions: [],
    joins: [],
    metrics: [
      {
        name: metricName,
        label: 'Arrears balance',
        definition: 'Overdue balance',
        expression: 'sum(x)',
        grain: 'account',
        tracesToQuestions: tracesTo,
        owner: 'Steward',
      },
    ],
  })

  it('fails when a metric traces to no Stage 1 question', () => {
    const results = getStage(6).exitCriteria(
      context({
        stageNumber: 6,
        artifacts: {
          'decision-register': snapshot('decision-register', register),
          'semantic-model': snapshot('semantic-model', model('arrears_balance', ['something else entirely'])),
        },
      }),
    )
    expect(results.find((r) => r.key === 'metrics-traced')?.passed).toBe(false)
  })

  it('fails when a metric name collides with another product in the workspace', () => {
    const results = getStage(6).exitCriteria(
      context({
        stageNumber: 6,
        otherProductMetricNames: [{ metric: 'arrears_balance', productKey: 'other' }],
        artifacts: {
          'decision-register': snapshot('decision-register', register),
          'semantic-model': snapshot(
            'semantic-model',
            model('arrears_balance', ['Which accounts crossed 60 days in arrears this week?']),
          ),
        },
      }),
    )
    expect(results.find((r) => r.key === 'metric-names-unique')?.passed).toBe(false)
  })
})

describe('Stage 9 — classification is a hard block', () => {
  it('fails when an attribute has no sensitivity classification', () => {
    const results = getStage(9).exitCriteria(
      context({
        stageNumber: 9,
        artifacts: {
          'attribute-register': snapshot('attribute-register', {
            attributes: [
              {
                name: 'customer_name',
                entity: 'Customer',
                businessDefinition: 'The name',
                sourceLineage: 'cis.customer.name',
                datatype: 'string',
                nullable: true,
                allowedValues: '',
                sensitivity: '',
                pii: true,
                regulatoryFlags: [],
                derivation: '',
                steward: 'Priya',
                patternExposure: [],
              },
            ],
            parkingLot: [],
          }),
        },
      }),
    )
    expect(results.find((r) => r.key === 'every-attribute-classified')?.passed).toBe(false)
  })
})

describe('Stage 10 — grounding purity', () => {
  const semantic = {
    entities: [{ name: 'Account', primaryEntity: true, description: '' }],
    dimensions: [],
    joins: [],
    metrics: [
      {
        name: 'arrears_balance',
        label: 'Arrears',
        definition: 'Overdue balance',
        expression: 'sum(x)',
        grain: 'account',
        tracesToQuestions: ['q?'],
        owner: 'Steward',
      },
    ],
  }

  it('rejects a grounding pack referencing a Bronze or Silver object', () => {
    const results = getStage(10).exitCriteria(
      context({
        stageNumber: 10,
        artifacts: {
          'semantic-model': snapshot('semantic-model', semantic),
          'grounding-pack': snapshot('grounding-pack', {
            sampleQuestions: ['a?', 'b?', 'c?'],
            glossaryTerms: [],
            metricDefinitions: [{ name: 'arrears_balance', definition: 'Overdue balance' }],
            allowedJoins: [],
            disambiguationHints: [],
            refusalGuidance: ['Refuse uncertified metrics.'],
            objectReferences: [{ object: 'silver_accounts', layer: 'SILVER' }],
          }),
        },
      }),
    )
    const purity = results.find((r) => r.key === 'grounding-purity')
    expect(purity?.passed).toBe(false)
    expect(purity?.detail).toContain('SILVER')
  })

  it('rejects a grounded metric that is not certified in the semantic model', () => {
    const results = getStage(10).exitCriteria(
      context({
        stageNumber: 10,
        artifacts: {
          'semantic-model': snapshot('semantic-model', semantic),
          'grounding-pack': snapshot('grounding-pack', {
            sampleQuestions: ['a?', 'b?', 'c?'],
            glossaryTerms: [],
            metricDefinitions: [{ name: 'made_up_metric', definition: 'Invented' }],
            allowedJoins: [],
            disambiguationHints: [],
            refusalGuidance: ['Refuse uncertified metrics.'],
            objectReferences: [],
          }),
        },
      }),
    )
    expect(results.find((r) => r.key === 'grounded-metrics-certified')?.passed).toBe(false)
  })
})

describe('Stage 11 — evidence, not assertion', () => {
  it('fails when a citation does not resolve', () => {
    const results = getStage(11).exitCriteria(
      context({
        stageNumber: 11,
        evidenceRefs: ['artifact:value-case@v1'],
        artifacts: {
          'certification-scorecard': snapshot('certification-scorecard', {
            certifiedBy: 'Council',
            dimensions: [
              'DISCOVERABLE',
              'ADDRESSABLE',
              'TRUSTWORTHY',
              'SELF_DESCRIBING',
              'INTEROPERABLE',
              'SECURE',
              'VALUABLE',
            ].map((dimension) => ({
              dimension,
              score: 4,
              citations: [{ kind: 'ARTIFACT_VERSION', ref: 'artifact:does-not-exist@v9', detail: '' }],
              note: '',
            })),
          }),
        },
      }),
    )
    expect(results.find((r) => r.key === 'citations-resolve')?.passed).toBe(false)
  })
})
