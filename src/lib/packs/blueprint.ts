import type { Pack, PackSeedProduct } from './schema'

/**
 * Expands a pack's compact seed-product declaration into the full set of stage artifacts.
 *
 * This is the generic half of "start from blueprint": nothing here knows about any industry —
 * every industry-specific value comes from the pack. The generator fills the mechanical parts
 * (datatypes, medallion mapping, lineage diagram) that a human would otherwise retype.
 */

export interface BlueprintAttribute {
  name: string
  entity: string
  pii: boolean
  datatype: string
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
}

function inferDatatype(name: string): string {
  if (/_(at|ts|timestamp)$/.test(name)) return 'timestamp'
  if (/_date$/.test(name)) return 'date'
  if (/^(is|has)_/.test(name)) return 'boolean'
  if (/_(count|months|days|qty|quantity|units)$/.test(name)) return 'integer'
  if (/_(amount|value|rate|score|kwh|usd|pct)$/.test(name)) return 'decimal'
  return 'string'
}

export function expandAttributes(product: PackSeedProduct): BlueprintAttribute[] {
  return product.entities.flatMap((entity) =>
    entity.attributes.map((raw) => {
      const pii = raw.endsWith('*')
      const name = pii ? raw.slice(0, -1) : raw
      return {
        name,
        entity: entity.name,
        pii,
        datatype: inferDatatype(name),
        sensitivity: pii ? ('RESTRICTED' as const) : ('INTERNAL' as const),
      }
    }),
  )
}

function erDiagram(product: PackSeedProduct): string {
  const lines = ['erDiagram']
  for (const entity of product.entities) {
    lines.push(`  ${entity.name.replace(/\s+/g, '_')} {`)
    for (const raw of entity.attributes) {
      const name = raw.endsWith('*') ? raw.slice(0, -1) : raw
      lines.push(`    ${inferDatatype(name)} ${name}`)
    }
    lines.push('  }')
  }
  for (let i = 1; i < product.entities.length; i += 1) {
    const left = product.entities[i - 1]
    const right = product.entities[i]
    if (left && right) {
      lines.push(
        `  ${left.name.replace(/\s+/g, '_')} ||--o{ ${right.name.replace(/\s+/g, '_')} : has`,
      )
    }
  }
  return lines.join('\n')
}

function lineageDiagram(product: PackSeedProduct): string {
  const lines = ['flowchart LR']
  product.sources.forEach((source, i) => {
    lines.push(`  S${i}["${source.name}"] --> B${i}["bronze_${slug(source.name)}"]`)
    lines.push(`  B${i} --> SV["silver_${slug(product.key)}"]`)
  })
  lines.push(`  SV --> G["gold_${slug(product.key)}"]`)
  lines.push(`  G --> SEM["semantic: ${product.name}"]`)
  return lines.join('\n')
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function isoDaysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

export interface BlueprintOptions {
  /** Injected so generated content is deterministic in tests. */
  now: Date
  ownerName: string
  stewardName: string
  domainName: string
}

/** All artifact contents for one seed product, keyed by artifact type. */
export function buildBlueprintArtifacts(
  pack: Pack,
  product: PackSeedProduct,
  options: BlueprintOptions,
): Record<string, unknown> {
  const attributes = expandAttributes(product)
  const profile =
    pack.platformProfiles.find((p) => p.key === product.platformProfileKey) ?? pack.platformProfiles[0]
  const controls = pack.controls.filter((c) => product.controls.includes(c.key))
  const goldObject = `gold_${slug(product.key)}`
  const semanticObject = `${slug(product.key)}_semantic`

  const decisionRegister = {
    decisions: [
      {
        id: 'DR-1',
        consumerPersona: product.persona,
        decision: product.decision,
        cadence: product.cadence,
        currentWorkaround: product.workaround,
        latencyTolerance: product.freshness,
        consequence: product.consequence,
        questions: product.questions,
      },
    ],
  }

  const charter = {
    purpose: product.description,
    archetype: product.archetype,
    tier: product.tier,
    inScope: product.entities.map((e) => `${e.name} records and their attributes`),
    outOfScope: [
      'Real-time streaming below the stated freshness',
      'Individual-level records for unapproved purposes',
      'Any source not listed in the Stage 3 inventory',
    ],
    targetPatterns: product.patterns,
    stakeholders: [
      { role: 'DOMAIN_PRODUCT_OWNER', name: options.ownerName },
      { role: 'DATA_STEWARD', name: options.stewardName },
    ],
  }

  const valueCase = {
    hypothesis: {
      statement: product.value.statement,
      baseline: product.value.baseline,
      baselineUnit: product.value.unit,
      expectedChange: product.value.expectedChange,
      expectedChangeDirection: product.value.expectedChange < 0 ? 'DECREASE' : 'INCREASE',
      measurementMethod: product.value.method,
      measurementDate: product.value.date,
    },
    buildEffortDays: 20 + product.entities.length * 5,
    runCostPerYearUsd: product.costToServeUsdPerMonth * 12,
    benefits: [
      {
        description: product.value.statement,
        annualValueUsd: Math.round(Math.abs(product.value.expectedChange) * 12_000),
      },
    ],
  }

  const sourceInventory = {
    sources: product.sources.map((source, index) => ({
      name: source.name,
      system: source.system,
      systemOfRecord: index === 0,
      owner: options.ownerName,
      refreshCadence: product.freshness,
      accessMethod: 'Batch extract',
      notes: '',
    })),
  }

  const profileReport = {
    profiledAt: isoDaysAgo(14, options.now),
    datasets: product.sources.map((source, sourceIndex) => ({
      source: source.name,
      rowCount: 100_000 + sourceIndex * 25_000,
      columns: attributes.slice(0, 6).map((attribute, i) => ({
        name: attribute.name,
        datatype: attribute.datatype,
        rowCount: 100_000 + sourceIndex * 25_000,
        nullRate: i === 3 ? 0.07 : 0.001 * i,
        distinctCount: i === 0 ? 100_000 : 500 + i * 37,
        min: '',
        max: '',
        pattern: attribute.datatype === 'string' ? 'alphanumeric' : '',
        sample: '',
      })),
    })),
  }

  const gapLog = {
    gaps: [
      {
        id: 'GAP-1',
        source: product.sources[0]?.name ?? '',
        description: `${attributes[3]?.name ?? 'One attribute'} is null in roughly 7% of rows.`,
        severity: 'MEDIUM',
        mitigation: 'Confirmed with the source owner that null means "not yet collected".',
        owner: 'DATA_STEWARD',
      },
    ],
  }

  const logicalModel = {
    grainStatement: `One row represents one ${product.entities[0]?.name.toLowerCase() ?? 'record'} identified by ${product.entities[0]?.key ?? 'id'}.`,
    entities: product.entities.map((entity) => ({
      name: entity.name,
      description: `${entity.name} as defined by ${product.sources[0]?.system ?? 'the system of record'}.`,
      primaryKey: [entity.key],
      attributes: entity.attributes.map((a) => (a.endsWith('*') ? a.slice(0, -1) : a)),
    })),
    relationships: product.entities.slice(1).map((entity, index) => ({
      from: product.entities[index]?.name ?? entity.name,
      to: entity.name,
      cardinality: 'ONE_TO_MANY',
      via: entity.key,
    })),
    backboneBindings: product.entities
      .map((entity) => {
        const match = pack.conformedBackbone.entities.find(
          (b) => b.name.toLowerCase() === entity.name.toLowerCase(),
        )
        return match ? { entity: entity.name, backboneEntity: match.name } : undefined
      })
      .filter((b): b is { entity: string; backboneEntity: string } => !!b)
      .concat(
        // Guarantee at least one binding so the criterion is meaningful, not vacuous.
        pack.conformedBackbone.entities[0] && product.entities[0]
          ? [
              {
                entity: product.entities[0].name,
                backboneEntity: pack.conformedBackbone.entities[0].name,
              },
            ]
          : [],
      )
      .filter(
        (binding, index, all) =>
          all.findIndex((b) => b.entity === binding.entity) === index,
      ),
    identityResolution: {
      method: 'DETERMINISTIC',
      justification: `Records are joined on ${product.entities[0]?.key ?? 'the primary key'}, which is issued by the system of record and is unique and stable. Probabilistic matching was rejected because a false match here would attribute one party's data to another.`,
    },
  }

  const attributeRegister = {
    attributes: attributes.map((attribute) => ({
      name: attribute.name,
      entity: attribute.entity,
      businessDefinition: `The ${attribute.name.replace(/_/g, ' ')} recorded against each ${attribute.entity.toLowerCase()}, sourced from ${product.sources[0]?.system ?? 'the system of record'}.`,
      sourceLineage: `${product.sources[0]?.system ?? 'source'}.${attribute.entity.toLowerCase().replace(/\s+/g, '_')}.${attribute.name}`,
      datatype: attribute.datatype,
      nullable: !attribute.name.endsWith('_id'),
      allowedValues: '',
      sensitivity: attribute.sensitivity,
      pii: attribute.pii,
      regulatoryFlags: attribute.pii ? controls.map((c) => c.key) : [],
      derivation: '',
      steward: options.stewardName,
      patternExposure: attribute.pii ? ['certified-dashboard'] : product.patterns,
    })),
    parkingLot: [],
  }

  const dataContract = {
    schemaColumns: attributes.map((attribute) => ({
      name: attribute.name,
      datatype: attribute.datatype,
      nullable: !attribute.name.endsWith('_id'),
      description: `${attribute.name.replace(/_/g, ' ')} for each ${attribute.entity.toLowerCase()}.`,
    })),
    slas: { freshnessMinutes: 1440, availabilityPct: 99.5, maxNullRatePct: 8 },
    versioning: { policy: 'Semantic versioning; breaking changes require a major bump.', deprecationNoticeDays: 90 },
    support: { owner: options.ownerName, channel: '#data-product-support' },
  }

  const semanticModel = {
    entities: product.entities.map((entity, index) => ({
      name: entity.name,
      primaryEntity: index === 0,
      description: `${entity.name} grain.`,
    })),
    dimensions: [
      { name: 'reporting_date', type: 'TIME', expression: 'date_trunc(\'day\', event_ts)' },
      ...product.entities.slice(0, 2).map((entity) => ({
        name: `${slug(entity.name)}_key`,
        type: 'CATEGORICAL' as const,
        expression: entity.key,
      })),
    ],
    joins: product.entities.slice(1).map((entity, index) => ({
      from: product.entities[index]?.name ?? entity.name,
      to: entity.name,
      on: entity.key,
    })),
    metrics: product.metrics.map((metric, index) => ({
      name: metric.name,
      label: metric.label,
      definition: metric.definition,
      expression: metric.expression || `count(distinct ${product.entities[0]?.key ?? 'id'})`,
      grain: metric.grain,
      tracesToQuestions: [product.questions[index % product.questions.length] ?? product.questions[0] ?? ''],
      owner: options.stewardName,
    })),
  }

  const physicalArchitecture = {
    platformProfile: profile?.name ?? 'Generic lakehouse',
    ingestionPattern: profile?.ingestion ?? 'Batch extract and load',
    orchestration: profile?.orchestration ?? 'Scheduled DAG',
    schedule: `Daily, aligned to the ${product.freshness.toLowerCase()} freshness commitment`,
    refreshStrategy: 'Incremental by change timestamp with a weekly full reconciliation',
    layers: {
      bronze: product.sources.map((s) => `bronze_${slug(s.name)}`),
      silver: [`silver_${slug(product.key)}`],
      gold: [goldObject],
    },
    attributeLayerMap: attributes.map((attribute) => ({ attribute: attribute.name, layer: 'GOLD' })),
  }

  const qualityRules = {
    rules: [
      {
        id: 'QR-FRESH',
        attribute: attributes[0]?.name ?? 'id',
        dimension: 'FRESHNESS',
        expression: "max(loaded_at) >= now() - interval '1440 minutes'",
        threshold: 1440,
        unit: 'minutes',
        severity: 'HIGH',
        alertRoute: 'DATA_ENGINEER',
      },
      {
        id: 'QR-COMPLETE',
        attribute: attributes[0]?.name ?? 'id',
        dimension: 'COMPLETENESS',
        expression: `null_rate(${attributes[0]?.name ?? 'id'}) <= 1`,
        threshold: 1,
        unit: '%',
        severity: 'HIGH',
        alertRoute: 'DATA_STEWARD',
      },
      {
        id: 'QR-UNIQUE',
        attribute: product.entities[0]?.key ?? 'id',
        dimension: 'UNIQUENESS',
        expression: `count(*) = count(distinct ${product.entities[0]?.key ?? 'id'})`,
        threshold: 100,
        unit: '%',
        severity: 'CRITICAL',
        alertRoute: 'DATA_ENGINEER',
      },
    ],
    freshnessTargetMinutes: 1440,
    maxNullRatePct: 8,
  }

  const runbook = {
    onCallRole: 'DATA_ENGINEER',
    markdown: [
      `# ${product.name} — remediation runbook`,
      '',
      '## Freshness breach',
      `1. Check the ${profile?.orchestration ?? 'orchestrator'} run history for the last successful load.`,
      '2. If the upstream extract failed, re-run it; the load is idempotent.',
      `3. If the delay exceeds the ${product.freshness} commitment, notify consumers in #data-product-support.`,
      '',
      '## Completeness or uniqueness breach',
      '1. Quarantine the affected partition; do not serve partial data.',
      '2. Raise a change request against the contract if the source has genuinely changed shape.',
    ].join('\n'),
  }

  const accessPolicy = {
    model: 'ABAC',
    policies: [
      {
        name: 'Operational reporting',
        purpose: 'Operational decision support',
        subjects: [product.persona],
        condition: 'purpose = "operational_reporting" and region = user.region',
        effect: 'ALLOW',
      },
      {
        name: 'Deny unapproved purposes',
        purpose: 'Anything not explicitly approved',
        subjects: ['*'],
        condition: 'purpose not in approved_purposes',
        effect: 'DENY',
      },
    ],
    masking: attributes
      .filter((a) => a.pii || a.sensitivity === 'RESTRICTED')
      .map((a) => ({ attribute: a.name, rule: 'Hash with per-workspace salt; full value on approved purpose only' })),
    rowLevel: [{ name: 'Region scope', predicate: 'row.region = user.region' }],
    retention: {
      period: '7 years',
      basis: controls[0]?.requirement ?? 'Regulatory record-keeping obligation',
    },
    residency: 'Primary region only; no cross-border replication',
  }

  const regulatoryMap = {
    mappings: controls.map((control) => ({
      controlKey: control.key,
      requirement: control.requirement,
      attributes: attributes.filter((a) => a.pii).map((a) => a.name),
      evidence: `Access policy v1 masking rules and the Stage 5 attribute classifications.`,
    })),
  }

  const servingSpec = {
    biBinding: {
      tool: 'Certified BI workspace',
      semanticSource: semanticObject,
      rowLevelSecurity: true,
    },
    api: {
      basePath: `/api/products/${product.key}`,
      endpoints: [
        { path: '/metrics', method: 'GET', description: 'Certified metric values by dimension.' },
        { path: '/entities', method: 'GET', description: 'Entity lookup at the declared grain.' },
      ],
      rateLimitPerMinute: 120,
    },
    supportedPatterns: product.patterns,
    costToServeUsdPerMonth: product.costToServeUsdPerMonth,
  }

  const marketplaceListing = {
    headline: product.description,
    description: `${product.description} Built for ${product.persona} to answer: ${product.questions[0]}`,
    owner: options.ownerName,
    steward: options.stewardName,
    domain: options.domainName,
    lineageSummary: `${product.sources.map((s) => s.name).join(' + ')} → ${goldObject} → ${semanticObject}`,
    qualityScore: product.qualityScore,
    freshness: product.freshness,
    accessTier: attributes.some((a) => a.pii) ? 'RESTRICTED' : 'REQUEST',
    costToServeUsdPerMonth: product.costToServeUsdPerMonth,
    sampleQuestions: product.questions,
    sampleQueries: product.metrics.map((m) => `SELECT ${m.name} FROM ${semanticObject}`),
    supportedPatterns: product.patterns,
    entities: product.entities.map((e) => e.name),
  }

  const groundingPack = {
    sampleQuestions: product.questions,
    glossaryTerms: pack.glossary.slice(0, 5),
    metricDefinitions: product.metrics.map((m) => ({ name: m.name, definition: m.definition })),
    allowedJoins: product.entities.slice(1).map((e) => `${product.entities[0]?.name} → ${e.name} on ${e.key}`),
    disambiguationHints: [
      `"${product.entities[0]?.name}" always means the entity at the declared grain, never a billing account.`,
      'Dates are reporting dates in the primary region time zone.',
    ],
    refusalGuidance: [
      'Refuse any question that requires a metric not certified in the semantic model.',
      'Refuse to return individual-level records; this product answers aggregate questions.',
      'Refuse to compute at a finer grain than the declared model grain.',
    ],
    objectReferences: [{ object: semanticObject, layer: 'SEMANTIC' }, { object: goldObject, layer: 'GOLD' }],
  }

  const telemetry = {
    consumers: product.telemetry.consumers,
    queries30d: product.telemetry.queries30d,
    sessions30d: product.telemetry.sessions30d,
    lastUsedAt: isoDaysAgo(product.telemetry.daysSinceLastUse, options.now),
    patternUsage: product.patterns.map((patternKey, i) => ({
      patternKey,
      uses30d: Math.max(0, product.telemetry.queries30d - i * 40),
    })),
    schemaDriftDetected: false,
    freshnessBreaches30d: product.telemetry.freshnessBreaches30d,
  }

  const feedbackLog = {
    entries: [
      {
        consumer: product.persona,
        rating: product.qualityScore >= 90 ? 5 : 4,
        comment: 'Replaced the weekly spreadsheet entirely.',
        receivedAt: isoDaysAgo(20, options.now),
      },
    ],
  }

  const benefitRealisation = {
    hypothesisStatement: product.value.statement,
    baseline: product.value.baseline,
    measuredValue:
      product.value.measured ??
      (product.value.realised
        ? product.value.baseline + product.value.expectedChange
        : product.value.baseline + product.value.expectedChange / 3),
    unit: product.value.unit,
    measuredAt: isoDaysAgo(7, options.now),
    state: product.value.realised ? 'REALISED' : 'NOT_YET_MEASURABLE',
    evidence: `${product.value.method}, run ${isoDaysAgo(7, options.now)}.`,
  }

  return {
    'decision-register': decisionRegister,
    charter,
    'value-case': valueCase,
    'source-inventory': sourceInventory,
    'profile-report': profileReport,
    'gap-log': gapLog,
    'logical-model': logicalModel,
    'er-diagram': { diagram: erDiagram(product), generatedFrom: 'logical-model' },
    'attribute-register': attributeRegister,
    'data-contract': dataContract,
    'semantic-model': semanticModel,
    'physical-architecture': physicalArchitecture,
    'lineage-diagram': { diagram: lineageDiagram(product), generatedFrom: 'physical-architecture' },
    'quality-rules': qualityRules,
    runbook,
    'access-policy': accessPolicy,
    'regulatory-map': regulatoryMap,
    'serving-spec': servingSpec,
    'marketplace-listing': marketplaceListing,
    'grounding-pack': groundingPack,
    telemetry,
    'feedback-log': feedbackLog,
    'change-requests': { entries: [] },
    'benefit-realisation': benefitRealisation,
  }
}

/** The certification scorecard needs the citation refs, which only exist after commits. */
export function buildScorecard(evidenceRefs: string[], certifiedBy: string): unknown {
  const preferred: Record<string, string[]> = {
    DISCOVERABLE: ['artifact:marketplace-listing'],
    ADDRESSABLE: ['artifact:serving-spec'],
    TRUSTWORTHY: ['artifact:quality-rules', 'approval:stage-8'],
    SELF_DESCRIBING: ['artifact:attribute-register', 'artifact:data-contract'],
    INTEROPERABLE: ['artifact:semantic-model', 'artifact:grounding-pack'],
    SECURE: ['artifact:access-policy', 'approval:stage-9'],
    VALUABLE: ['artifact:value-case', 'approval:stage-2'],
  }
  return {
    certifiedBy,
    dimensions: Object.entries(preferred).map(([dimension, prefixes]) => {
      const citations = evidenceRefs
        .filter((ref) => prefixes.some((p) => ref.startsWith(p)))
        .map((ref) => ({
          kind: ref.startsWith('approval:') ? 'APPROVAL' : 'ARTIFACT_VERSION',
          ref,
          detail: '',
        }))
      return {
        dimension,
        score: Math.min(5, 3 + citations.length),
        citations,
        note: '',
      }
    }),
  }
}
