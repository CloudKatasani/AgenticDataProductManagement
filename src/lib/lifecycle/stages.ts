import {
  accessPolicySchema,
  attributeRegisterSchema,
  benefitRealisationSchema,
  certificationScorecardSchema,
  charterSchema,
  dataContractSchema,
  decisionRegisterSchema,
  diagramSchema,
  gapLogSchema,
  groundingPackSchema,
  logicalModelSchema,
  marketplaceListingSchema,
  physicalArchitectureSchema,
  profileReportSchema,
  qualityRulesSchema,
  regulatoryMapSchema,
  runbookSchema,
  semanticModelSchema,
  servingSpecSchema,
  sourceInventorySchema,
  telemetrySchema,
  valueCaseSchema,
} from '@/lib/artifacts/registry'
import type { RoleKey } from '@/lib/domain/roles'
import {
  criterion,
  commentsCriterion,
  parseArtifact,
  referencesQuestion,
  universalCriteria,
  type CriterionResult,
  type StageContext,
} from './criteria'

/**
 * The 12-stage lifecycle AS DATA. Approver roles, quorum, veto rights and exit criteria all
 * live here. Adding or reordering a stage must never require a change to transitions.ts.
 */

export interface StageDefinition {
  number: number
  key: string
  name: string
  purpose: string
  /** Plain-language framing shown in the "Why this stage matters" panel. */
  whyItMatters: string
  requiredArtifacts: string[]
  optionalArtifacts: string[]
  approverRoles: RoleKey[]
  quorum: number
  vetoRoles: RoleKey[]
  permittedAgents: string[]
  guideKey: string
  exitCriteria: (ctx: StageContext) => CriterionResult[]
}

function questionsFromRegister(ctx: StageContext): string[] {
  const register = parseArtifact(ctx, 'decision-register', decisionRegisterSchema)
  return register ? register.decisions.flatMap((d) => d.questions) : []
}

function attributeNames(ctx: StageContext): string[] {
  const register = parseArtifact(ctx, 'attribute-register', attributeRegisterSchema)
  return register ? register.attributes.map((a) => a.name) : []
}

export const STAGES: StageDefinition[] = [
  {
    number: 1,
    key: 'consumption-discovery',
    name: 'Consumption Discovery',
    purpose: 'Name the consumer, the decision they cannot make today, and the questions they would ask.',
    whyItMatters:
      'Every data asset nobody uses was built without this stage. Starting from a source system produces a table; starting from a blocked decision produces a product someone opens on Monday morning.',
    requiredArtifacts: ['decision-register'],
    optionalArtifacts: [],
    approverRoles: ['DOMAIN_PRODUCT_OWNER', 'DOMAIN_SME'],
    quorum: 2,
    vetoRoles: [],
    permittedAgents: ['discovery', 'curator', 'critic'],
    guideKey: 'stage-1',
    exitCriteria: (ctx) => {
      const register = parseArtifact(ctx, 'decision-register', decisionRegisterSchema)
      const complete = register?.decisions ?? []
      const withEnoughQuestions = complete.filter((d) => d.questions.length >= 3)
      const namedPersona = complete.filter(
        (d) => d.consumerPersona.trim().length > 0 && !/^the business$/i.test(d.consumerPersona.trim()),
      )
      return [
        ...universalCriteria(ctx, ['decision-register']),
        criterion(
          'one-complete-decision',
          'At least one complete decision record exists',
          withEnoughQuestions.length >= 1,
          withEnoughQuestions.length
            ? `${withEnoughQuestions.length} decision record(s) with three or more questions.`
            : 'No decision record yet carries three or more questions.',
        ),
        criterion(
          'named-persona',
          'Every record names a real consumer role, not "the business"',
          complete.length > 0 && namedPersona.length === complete.length,
          complete.length === 0
            ? 'No decision records yet.'
            : `${namedPersona.length} of ${complete.length} record(s) name a specific role.`,
        ),
        criterion(
          'workaround-stated',
          'Each record states the current workaround and its cost',
          complete.every((d) => d.currentWorkaround.trim().length > 0),
          complete.every((d) => d.currentWorkaround.trim().length > 0)
            ? 'Workarounds captured — this is your baseline for Stage 2.'
            : 'One or more records have no current workaround recorded.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 2,
    key: 'charter-value-case',
    name: 'Charter & Value Case',
    purpose: 'Fix the scope boundary and commit to a measurable value hypothesis.',
    whyItMatters:
      'A charter without an out-of-scope list grows until it fails. A value case without a measurement date is never measured — and the organisation never learns whether the last ten products were worth building.',
    requiredArtifacts: ['charter', 'value-case'],
    optionalArtifacts: [],
    approverRoles: ['DOMAIN_PRODUCT_OWNER', 'GOVERNANCE_COUNCIL'],
    quorum: 2,
    vetoRoles: ['DOMAIN_PRODUCT_OWNER'],
    permittedAgents: ['critic'],
    guideKey: 'stage-2',
    exitCriteria: (ctx) => {
      const charter = parseArtifact(ctx, 'charter', charterSchema)
      const value = parseArtifact(ctx, 'value-case', valueCaseSchema)
      const hypothesis = value?.hypothesis
      const measurable =
        !!hypothesis &&
        hypothesis.statement.trim().length > 0 &&
        Number.isFinite(hypothesis.baseline) &&
        Number.isFinite(hypothesis.expectedChange) &&
        hypothesis.expectedChange !== 0 &&
        hypothesis.measurementMethod.trim().length > 0 &&
        !Number.isNaN(Date.parse(hypothesis.measurementDate))
      const patternsKnown = (charter?.targetPatterns ?? []).every((p) => ctx.patternKeys.includes(p))
      return [
        ...universalCriteria(ctx, ['charter', 'value-case']),
        criterion(
          'stage-1-approved',
          'Stage 1 is approved — consumption before charter',
          ctx.approvedStages.includes(1),
          ctx.approvedStages.includes(1)
            ? 'Stage 1 gate approved.'
            : 'Stage 2 is hard-blocked until a Stage 1 decision register is approved.',
        ),
        criterion(
          'out-of-scope-declared',
          'The charter declares what this product is explicitly not',
          (charter?.outOfScope.length ?? 0) > 0,
          charter?.outOfScope.length
            ? `${charter.outOfScope.length} out-of-scope item(s).`
            : 'No out-of-scope list. Scope with no boundary is not scope.',
        ),
        criterion(
          'measurable-hypothesis',
          'The value hypothesis is measurable',
          measurable,
          measurable
            ? `Baseline ${hypothesis?.baseline} ${hypothesis?.baselineUnit}, expected change ${hypothesis?.expectedChange}, measured on ${hypothesis?.measurementDate}.`
            : 'A hypothesis needs a baseline, a non-zero expected change, a method and a measurement date.',
        ),
        criterion(
          'target-patterns-known',
          'Target consumption patterns come from the pattern registry',
          patternsKnown && (charter?.targetPatterns.length ?? 0) > 0,
          charter?.targetPatterns.length
            ? patternsKnown
              ? `Targets: ${charter.targetPatterns.join(', ')}.`
              : 'One or more target patterns are not registry patterns.'
            : 'Name at least one target consumption pattern.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 3,
    key: 'source-discovery-profiling',
    name: 'Source Discovery & Profiling',
    purpose: 'Find the sources, designate the system of record, and see the data as it actually is.',
    whyItMatters:
      'Most delivery failures are discovered here and denied until Stage 8. Profiling before modelling turns "the field is always populated" into a number.',
    requiredArtifacts: ['source-inventory', 'profile-report', 'gap-log'],
    optionalArtifacts: [],
    approverRoles: ['DATA_ARCHITECT', 'DATA_STEWARD'],
    quorum: 2,
    vetoRoles: [],
    permittedAgents: ['profiling', 'critic'],
    guideKey: 'stage-3',
    exitCriteria: (ctx) => {
      const inventory = parseArtifact(ctx, 'source-inventory', sourceInventorySchema)
      const profile = parseArtifact(ctx, 'profile-report', profileReportSchema)
      const gaps = parseArtifact(ctx, 'gap-log', gapLogSchema)
      const sorCount = inventory?.sources.filter((s) => s.systemOfRecord).length ?? 0
      const profiledSources = new Set(profile?.datasets.map((d) => d.source) ?? [])
      const unprofiled = (inventory?.sources ?? []).filter((s) => !profiledSources.has(s.name))
      const unownedSevere = (gaps?.gaps ?? []).filter(
        (g) => (g.severity === 'HIGH' || g.severity === 'CRITICAL') && !g.owner.trim(),
      )
      return [
        ...universalCriteria(ctx, ['source-inventory', 'profile-report', 'gap-log']),
        criterion(
          'system-of-record',
          'Exactly one system of record is designated',
          sorCount === 1,
          sorCount === 1
            ? 'One system of record designated.'
            : `${sorCount} source(s) marked as system of record — there must be exactly one.`,
        ),
        criterion(
          'sources-profiled',
          'Every inventoried source has been profiled',
          (inventory?.sources.length ?? 0) > 0 && unprofiled.length === 0,
          unprofiled.length === 0
            ? `${profiledSources.size} source(s) profiled.`
            : `Not profiled: ${unprofiled.map((s) => s.name).join(', ')}.`,
        ),
        criterion(
          'severe-gaps-owned',
          'Every high or critical gap has a named owner',
          unownedSevere.length === 0,
          unownedSevere.length === 0
            ? 'All severe gaps are owned.'
            : `${unownedSevere.length} severe gap(s) with no owner.`,
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 4,
    key: 'conceptual-logical-model',
    name: 'Conceptual & Logical Model',
    purpose: 'State the grain, the entities, the keys and how identity is resolved.',
    whyItMatters:
      'An unstated grain is the single most common cause of two dashboards disagreeing. Writing it down forces the argument to happen now rather than in front of an executive.',
    requiredArtifacts: ['logical-model', 'er-diagram'],
    optionalArtifacts: [],
    approverRoles: ['DATA_ARCHITECT', 'DOMAIN_SME'],
    quorum: 2,
    vetoRoles: ['DATA_ARCHITECT'],
    permittedAgents: ['modelling', 'critic'],
    guideKey: 'stage-4',
    exitCriteria: (ctx) => {
      const model = parseArtifact(ctx, 'logical-model', logicalModelSchema)
      const er = parseArtifact(ctx, 'er-diagram', diagramSchema)
      const keyless = (model?.entities ?? []).filter((e) => e.primaryKey.length === 0)
      const justification = model?.identityResolution.justification.trim() ?? ''
      return [
        ...universalCriteria(ctx, ['logical-model', 'er-diagram']),
        criterion(
          'grain-stated',
          'An explicit grain statement exists',
          (model?.grainStatement.trim().length ?? 0) > 10,
          model?.grainStatement
            ? `Grain: ${model.grainStatement}`
            : 'No grain statement. One row of this product represents… what?',
        ),
        criterion(
          'entities-keyed',
          'Every entity declares a primary key',
          (model?.entities.length ?? 0) > 0 && keyless.length === 0,
          keyless.length === 0
            ? `${model?.entities.length ?? 0} entity/entities keyed.`
            : `No primary key on: ${keyless.map((e) => e.name).join(', ')}.`,
        ),
        criterion(
          'identity-resolution-justified',
          'Identity resolution declares a method and justifies it in writing',
          justification.length >= 40,
          justification.length >= 40
            ? `${model?.identityResolution.method} resolution, justified.`
            : 'Declare deterministic, probabilistic or hybrid resolution and justify the choice in writing.',
        ),
        criterion(
          'backbone-bound',
          'At least one entity binds to the pack conformed backbone',
          (model?.backboneBindings.length ?? 0) > 0,
          model?.backboneBindings.length
            ? `${model.backboneBindings.length} backbone binding(s) — this is where reuse comes from.`
            : 'Nothing binds to the conformed backbone; this product will not compose with others.',
        ),
        criterion(
          'er-generated',
          'The ER diagram reflects the logical model',
          (er?.diagram.trim().length ?? 0) > 0,
          er?.diagram ? 'ER diagram present.' : 'Generate the ER diagram from the logical model.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 5,
    key: 'attribute-register-contract',
    name: 'Attribute Register & Data Contract',
    purpose: 'Define every attribute and turn the definitions into a contract with SLAs.',
    whyItMatters:
      'This is where trust is actually built or lost. An attribute with no business definition is a support ticket waiting to happen; an attribute with no sensitivity classification is a breach waiting to happen.',
    requiredArtifacts: ['attribute-register', 'data-contract'],
    optionalArtifacts: [],
    approverRoles: ['DATA_STEWARD', 'DOMAIN_SME', 'DOMAIN_PRODUCT_OWNER'],
    quorum: 3,
    vetoRoles: ['DATA_STEWARD'],
    permittedAgents: ['definition', 'critic'],
    guideKey: 'stage-5',
    exitCriteria: (ctx) => {
      const register = parseArtifact(ctx, 'attribute-register', attributeRegisterSchema)
      const contract = parseArtifact(ctx, 'data-contract', dataContractSchema)
      const attrs = register?.attributes ?? []
      const undefined_ = attrs.filter((a) => a.businessDefinition.trim().length < 10)
      const unlineaged = attrs.filter((a) => !a.sourceLineage.trim())
      const names = new Set(attrs.map((a) => a.name))
      const orphanColumns = (contract?.schemaColumns ?? []).filter((c) => !names.has(c.name))
      return [
        ...universalCriteria(ctx, ['attribute-register', 'data-contract']),
        criterion(
          'definitions-written',
          'Every attribute carries a real business definition',
          attrs.length > 0 && undefined_.length === 0,
          undefined_.length === 0
            ? `${attrs.length} attribute(s) defined.`
            : `${undefined_.length} attribute(s) have no usable definition.`,
        ),
        criterion(
          'lineage-recorded',
          'Every attribute records its source lineage',
          attrs.length > 0 && unlineaged.length === 0,
          unlineaged.length === 0
            ? 'Lineage recorded for every attribute.'
            : `${unlineaged.length} attribute(s) have no source lineage.`,
        ),
        criterion(
          'contract-matches-register',
          'Every contract column exists in the attribute register',
          orphanColumns.length === 0 && (contract?.schemaColumns.length ?? 0) > 0,
          orphanColumns.length === 0
            ? `${contract?.schemaColumns.length ?? 0} contract column(s) reconciled.`
            : `Contract references unknown attributes: ${orphanColumns.map((c) => c.name).join(', ')}.`,
        ),
        criterion(
          'slas-stated',
          'The contract states freshness, availability and null-rate SLAs',
          !!contract && contract.slas.freshnessMinutes > 0 && contract.slas.availabilityPct > 0,
          contract
            ? `Freshness ${contract.slas.freshnessMinutes} min, availability ${contract.slas.availabilityPct}%.`
            : 'No SLAs stated.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 6,
    key: 'semantic-model-metrics',
    name: 'Semantic Model & Metrics',
    purpose: 'Define each metric once, and prove it answers a question someone actually asked.',
    whyItMatters:
      'One metric, one definition, one answer — in every dashboard, every notebook, every conversation and every agent. A metric that traces to no question is a metric nobody needed.',
    requiredArtifacts: ['semantic-model'],
    optionalArtifacts: [],
    approverRoles: ['SEMANTIC_STEWARD', 'DOMAIN_SME'],
    quorum: 2,
    vetoRoles: ['SEMANTIC_STEWARD'],
    permittedAgents: ['semantic', 'critic'],
    guideKey: 'stage-6',
    exitCriteria: (ctx) => {
      const model = parseArtifact(ctx, 'semantic-model', semanticModelSchema)
      const questions = questionsFromRegister(ctx)
      const metrics = model?.metrics ?? []
      const untraced = metrics.filter(
        (m) => !m.tracesToQuestions.some((q) => referencesQuestion(q, questions)),
      )
      const localNames = metrics.map((m) => m.name.toLowerCase())
      const duplicatedLocally = localNames.filter((n, i) => localNames.indexOf(n) !== i)
      const collisions = metrics.filter((m) =>
        ctx.otherProductMetricNames.some(
          (other) => other.metric.toLowerCase() === m.name.toLowerCase(),
        ),
      )
      return [
        ...universalCriteria(ctx, ['semantic-model']),
        criterion(
          'metrics-traced',
          'Every metric traces to a Stage 1 question',
          metrics.length > 0 && untraced.length === 0,
          untraced.length === 0
            ? `${metrics.length} metric(s), all traced to a question a consumer actually asked.`
            : `Untraced: ${untraced.map((m) => m.name).join(', ')}.`,
        ),
        criterion(
          'metric-names-unique',
          'Metric names are unique across the workspace',
          duplicatedLocally.length === 0 && collisions.length === 0,
          duplicatedLocally.length === 0 && collisions.length === 0
            ? 'No name collisions.'
            : `Collides with existing metrics: ${[
                ...new Set([
                  ...duplicatedLocally,
                  ...collisions.map((c) => c.name),
                ]),
              ].join(', ')}.`,
        ),
        criterion(
          'metric-grain-stated',
          'Every metric states its grain and expression',
          metrics.every((m) => m.grain.trim() && m.expression.trim()),
          metrics.every((m) => m.grain.trim() && m.expression.trim())
            ? 'Grain and expression present on every metric.'
            : 'One or more metrics have no grain or no expression.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 7,
    key: 'physical-architecture',
    name: 'Physical Architecture',
    purpose: 'Map the design onto a platform without letting the platform dictate the design.',
    whyItMatters:
      'This stage is late on purpose. Deciding the platform first is how organisations end up with a warehouse full of tables that answer no question.',
    requiredArtifacts: ['physical-architecture', 'lineage-diagram'],
    optionalArtifacts: [],
    approverRoles: ['DATA_ARCHITECT', 'DATA_ENGINEER'],
    quorum: 2,
    vetoRoles: ['DATA_ARCHITECT'],
    permittedAgents: ['critic'],
    guideKey: 'stage-7',
    exitCriteria: (ctx) => {
      const arch = parseArtifact(ctx, 'physical-architecture', physicalArchitectureSchema)
      const lineage = parseArtifact(ctx, 'lineage-diagram', diagramSchema)
      const attrs = attributeNames(ctx)
      const mapped = new Set((arch?.attributeLayerMap ?? []).map((m) => m.attribute))
      const unmapped = attrs.filter((a) => !mapped.has(a))
      return [
        ...universalCriteria(ctx, ['physical-architecture', 'lineage-diagram']),
        criterion(
          'platform-profile',
          'A platform profile from the pack is selected',
          (arch?.platformProfile.trim().length ?? 0) > 0,
          arch?.platformProfile ? `Profile: ${arch.platformProfile}.` : 'No platform profile chosen.',
        ),
        criterion(
          'attributes-layered',
          'Every registered attribute is mapped to a medallion layer',
          attrs.length > 0 && unmapped.length === 0,
          unmapped.length === 0
            ? `${attrs.length} attribute(s) mapped.`
            : `Unmapped: ${unmapped.slice(0, 8).join(', ')}${unmapped.length > 8 ? '…' : ''}.`,
        ),
        criterion(
          'gold-layer-populated',
          'The gold layer is populated — something is actually served',
          (arch?.layers.gold.length ?? 0) > 0,
          arch?.layers.gold.length
            ? `${arch.layers.gold.length} gold object(s).`
            : 'Nothing in the gold layer.',
        ),
        criterion(
          'lineage-generated',
          'A lineage diagram exists',
          (lineage?.diagram.trim().length ?? 0) > 0,
          lineage?.diagram ? 'Lineage diagram present.' : 'Generate the lineage diagram.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 8,
    key: 'quality-observability',
    name: 'Quality & Observability',
    purpose: 'Bind quality rules to attributes and reconcile them with the contract.',
    whyItMatters:
      'A contract promising 30-minute freshness and a monitor checking daily is a promise nobody is keeping. Reconciling the two is the difference between observability and decoration.',
    requiredArtifacts: ['quality-rules', 'runbook'],
    optionalArtifacts: [],
    approverRoles: ['DATA_STEWARD', 'DATA_ENGINEER'],
    quorum: 2,
    vetoRoles: ['DATA_STEWARD'],
    permittedAgents: ['quality', 'critic'],
    guideKey: 'stage-8',
    exitCriteria: (ctx) => {
      const rules = parseArtifact(ctx, 'quality-rules', qualityRulesSchema)
      const contract = parseArtifact(ctx, 'data-contract', dataContractSchema)
      const runbook = parseArtifact(ctx, 'runbook', runbookSchema)
      const attrs = new Set(attributeNames(ctx))
      const orphanRules = (rules?.rules ?? []).filter((r) => !attrs.has(r.attribute))
      const dimensionsCovered = new Set((rules?.rules ?? []).map((r) => r.dimension))
      const freshnessOk =
        !!rules && !!contract && rules.freshnessTargetMinutes <= contract.slas.freshnessMinutes
      const nullOk = !!rules && !!contract && rules.maxNullRatePct <= contract.slas.maxNullRatePct
      return [
        ...universalCriteria(ctx, ['quality-rules', 'runbook']),
        criterion(
          'rules-bound-to-attributes',
          'Every rule targets an attribute in the register',
          (rules?.rules.length ?? 0) > 0 && orphanRules.length === 0,
          orphanRules.length === 0
            ? `${rules?.rules.length ?? 0} rule(s) bound.`
            : `Rules target unknown attributes: ${orphanRules.map((r) => r.attribute).join(', ')}.`,
        ),
        criterion(
          'contract-reconciled',
          'Thresholds do not contradict the Stage 5 contract',
          freshnessOk && nullOk,
          freshnessOk && nullOk
            ? 'Monitoring is at least as strict as the contract promises.'
            : 'A monitoring threshold is looser than the contract SLA it is supposed to defend.',
        ),
        criterion(
          'core-dimensions-covered',
          'Freshness and completeness are both monitored',
          dimensionsCovered.has('FRESHNESS') && dimensionsCovered.has('COMPLETENESS'),
          `Dimensions covered: ${[...dimensionsCovered].join(', ') || 'none'}.`,
        ),
        criterion(
          'runbook-actionable',
          'The runbook tells an on-call engineer what to do',
          (runbook?.markdown.trim().length ?? 0) >= 40 && !!runbook?.onCallRole.trim(),
          runbook?.onCallRole
            ? `On call: ${runbook.onCallRole}.`
            : 'No on-call role or no remediation content.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 9,
    key: 'access-governance',
    name: 'Access & Governance',
    purpose: 'Classify everything, decide who may see what and for what purpose, and map the regulations.',
    whyItMatters:
      'This gate is where a data product stops being a private project. The Privacy & Security Officer holds a hard veto here because no downstream benefit outweighs an unclassified restricted attribute reaching a consumer.',
    requiredArtifacts: ['access-policy', 'regulatory-map'],
    optionalArtifacts: [],
    approverRoles: ['PRIVACY_SECURITY_OFFICER', 'DOMAIN_PRODUCT_OWNER'],
    quorum: 2,
    vetoRoles: ['PRIVACY_SECURITY_OFFICER'],
    permittedAgents: ['compliance', 'critic'],
    guideKey: 'stage-9',
    exitCriteria: (ctx) => {
      const register = parseArtifact(ctx, 'attribute-register', attributeRegisterSchema)
      const policy = parseArtifact(ctx, 'access-policy', accessPolicySchema)
      const regmap = parseArtifact(ctx, 'regulatory-map', regulatoryMapSchema)
      const attrs = register?.attributes ?? []
      const unclassified = attrs.filter((a) => !a.sensitivity)
      const maskedAttrs = new Set((policy?.masking ?? []).map((m) => m.attribute))
      const exposedSensitive = attrs.filter(
        (a) => (a.pii || a.sensitivity === 'RESTRICTED') && !maskedAttrs.has(a.name),
      )
      const unknownControls = (regmap?.mappings ?? []).filter(
        (m) => ctx.packControlKeys.length > 0 && !ctx.packControlKeys.includes(m.controlKey),
      )
      return [
        ...universalCriteria(ctx, ['access-policy', 'regulatory-map']),
        criterion(
          'every-attribute-classified',
          'Every attribute carries a sensitivity classification',
          attrs.length > 0 && unclassified.length === 0,
          unclassified.length === 0
            ? `${attrs.length} attribute(s) classified.`
            : `${unclassified.length} attribute(s) unclassified — this gate cannot open.`,
        ),
        criterion(
          'sensitive-attributes-protected',
          'Every PII or restricted attribute has a masking rule',
          exposedSensitive.length === 0,
          exposedSensitive.length === 0
            ? 'All sensitive attributes carry a masking rule.'
            : `Unmasked: ${exposedSensitive.map((a) => a.name).join(', ')}.`,
        ),
        criterion(
          'controls-from-library',
          'Regulatory mappings reference the pack control library',
          (regmap?.mappings.length ?? 0) > 0 && unknownControls.length === 0,
          unknownControls.length === 0
            ? `${regmap?.mappings.length ?? 0} control(s) mapped.`
            : `Unknown control keys: ${unknownControls.map((m) => m.controlKey).join(', ')}.`,
        ),
        criterion(
          'retention-and-residency',
          'Retention period, legal basis and residency are stated',
          !!policy?.retention.period.trim() &&
            !!policy?.retention.basis.trim() &&
            !!policy?.residency.trim(),
          policy?.retention.period
            ? `Retention ${policy.retention.period} (${policy.retention.basis}), residency ${policy.residency}.`
            : 'Retention or residency not stated.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 10,
    key: 'serving-consumption',
    name: 'Serving & Consumption',
    purpose: 'Make the product actually consumable — and safely groundable for agents.',
    whyItMatters:
      'A product that exists but cannot be reached is not a product. And a grounding pack pointed at raw tables is how a chatbot confidently reports a number no human would sign.',
    requiredArtifacts: ['serving-spec', 'marketplace-listing', 'grounding-pack'],
    optionalArtifacts: [],
    approverRoles: ['SEMANTIC_STEWARD', 'DOMAIN_PRODUCT_OWNER'],
    quorum: 2,
    vetoRoles: ['SEMANTIC_STEWARD'],
    permittedAgents: ['grounding', 'critic'],
    guideKey: 'stage-10',
    exitCriteria: (ctx) => {
      const serving = parseArtifact(ctx, 'serving-spec', servingSpecSchema)
      const listing = parseArtifact(ctx, 'marketplace-listing', marketplaceListingSchema)
      const grounding = parseArtifact(ctx, 'grounding-pack', groundingPackSchema)
      const semantic = parseArtifact(ctx, 'semantic-model', semanticModelSchema)
      const rawRefs = (grounding?.objectReferences ?? []).filter(
        (o) => o.layer === 'BRONZE' || o.layer === 'SILVER',
      )
      const certifiedMetrics = new Set((semantic?.metrics ?? []).map((m) => m.name.toLowerCase()))
      const uncertifiedMetrics = (grounding?.metricDefinitions ?? []).filter(
        (m) => !certifiedMetrics.has(m.name.toLowerCase()),
      )
      const unknownPatterns = (serving?.supportedPatterns ?? []).filter(
        (p) => !ctx.patternKeys.includes(p),
      )
      return [
        ...universalCriteria(ctx, ['serving-spec', 'marketplace-listing', 'grounding-pack']),
        criterion(
          'grounding-purity',
          'The grounding pack references only certified semantic objects',
          rawRefs.length === 0,
          rawRefs.length === 0
            ? 'No Bronze or Silver references — grounding purity holds.'
            : `Rejected: grounding references physical ${rawRefs
                .map((r) => `${r.object} (${r.layer})`)
                .join(', ')}.`,
        ),
        criterion(
          'grounded-metrics-certified',
          'Every metric in the grounding pack is a certified Stage 6 metric',
          (grounding?.metricDefinitions.length ?? 0) > 0 && uncertifiedMetrics.length === 0,
          uncertifiedMetrics.length === 0
            ? 'All grounded metrics are certified.'
            : `Not certified: ${uncertifiedMetrics.map((m) => m.name).join(', ')}.`,
        ),
        criterion(
          'refusal-guidance',
          'The grounding pack tells the model when to refuse',
          (grounding?.refusalGuidance.length ?? 0) > 0,
          grounding?.refusalGuidance.length
            ? `${grounding.refusalGuidance.length} refusal rule(s).`
            : 'No refusal guidance. An agent with no refusal rule answers everything, including wrongly.',
        ),
        criterion(
          'listing-complete',
          'The marketplace listing is complete enough for a consumer to judge',
          !!listing &&
            listing.description.trim().length > 30 &&
            listing.freshness.trim().length > 0 &&
            listing.qualityScore > 0,
          listing
            ? `Quality ${listing.qualityScore}, freshness ${listing.freshness}.`
            : 'No marketplace listing.',
        ),
        criterion(
          'patterns-known',
          'Supported patterns come from the pattern registry',
          unknownPatterns.length === 0 && (serving?.supportedPatterns.length ?? 0) > 0,
          unknownPatterns.length === 0
            ? `Serving: ${serving?.supportedPatterns.join(', ') ?? ''}.`
            : `Unknown patterns: ${unknownPatterns.join(', ')}.`,
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 11,
    key: 'certification-publication',
    name: 'Certification & Publication',
    purpose: 'Score DATSIS+V against cited evidence and publish.',
    whyItMatters:
      'Trust is demonstrated, not badged. Every dimension of this scorecard cites a specific artifact version or approval, so "trustworthy" means something a sceptic can check.',
    requiredArtifacts: ['certification-scorecard'],
    optionalArtifacts: [],
    approverRoles: ['GOVERNANCE_COUNCIL', 'DOMAIN_PRODUCT_OWNER'],
    quorum: 2,
    vetoRoles: ['GOVERNANCE_COUNCIL'],
    permittedAgents: ['evidence', 'critic'],
    guideKey: 'stage-11',
    exitCriteria: (ctx) => {
      const card = parseArtifact(ctx, 'certification-scorecard', certificationScorecardSchema)
      const dims = card?.dimensions ?? []
      const uncited = dims.filter((d) => d.citations.length === 0)
      const danglingCitations = dims.flatMap((d) =>
        d.citations.filter((c) => !ctx.evidenceRefs.includes(c.ref)).map((c) => c.ref),
      )
      const priorApproved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
        (n) => !ctx.approvedStages.includes(n),
      )
      return [
        ...universalCriteria(ctx, ['certification-scorecard']),
        criterion(
          'all-dimensions-scored',
          'All seven DATSIS+V dimensions are scored',
          dims.length === 7,
          `${dims.length} of 7 dimensions scored.`,
        ),
        criterion(
          'every-dimension-cited',
          'Every dimension cites evidence, not free text',
          dims.length > 0 && uncited.length === 0,
          uncited.length === 0
            ? 'Every dimension carries at least one citation.'
            : `Uncited: ${uncited.map((d) => d.dimension).join(', ')}.`,
        ),
        criterion(
          'citations-resolve',
          'Every citation resolves to a real artifact version or approval',
          danglingCitations.length === 0,
          danglingCitations.length === 0
            ? 'All citations resolve.'
            : `Dangling: ${[...new Set(danglingCitations)].join(', ')}.`,
        ),
        criterion(
          'upstream-approved',
          'Stages 1 to 10 are all approved and none has gone stale',
          priorApproved.length === 0,
          priorApproved.length === 0
            ? 'Every upstream gate is approved.'
            : `Not currently approved: stage ${priorApproved.join(', ')}.`,
        ),
        commentsCriterion(ctx),
      ]
    },
  },
  {
    number: 12,
    key: 'operate-evolve-retire',
    name: 'Operate, Evolve & Retire',
    purpose: 'Measure what it returned, absorb change honestly, and retire it when it stops earning its place.',
    whyItMatters:
      'Products that never returned value should be visible in the portfolio, not quietly forgotten. This stage is the only reason the value hypothesis at Stage 2 means anything.',
    requiredArtifacts: ['telemetry', 'feedback-log', 'change-requests', 'benefit-realisation'],
    optionalArtifacts: [],
    approverRoles: ['DOMAIN_PRODUCT_OWNER'],
    quorum: 1,
    vetoRoles: ['GOVERNANCE_COUNCIL'],
    permittedAgents: ['steward', 'critic'],
    guideKey: 'stage-12',
    exitCriteria: (ctx) => {
      const benefit = parseArtifact(ctx, 'benefit-realisation', benefitRealisationSchema)
      const value = parseArtifact(ctx, 'value-case', valueCaseSchema)
      const telemetry = parseArtifact(ctx, 'telemetry', telemetrySchema)
      const hypothesisMatches =
        !!benefit &&
        !!value &&
        benefit.hypothesisStatement.trim().toLowerCase() ===
          value.hypothesis.statement.trim().toLowerCase()
      return [
        ...universalCriteria(ctx, [
          'telemetry',
          'feedback-log',
          'change-requests',
          'benefit-realisation',
        ]),
        criterion(
          'published',
          'The product is published',
          ctx.product.status === 'PUBLISHED' || ctx.product.status === 'DEPRECATED',
          `Status: ${ctx.product.status}.`,
        ),
        criterion(
          'benefit-measured-against-hypothesis',
          'Benefit realisation measures the Stage 2 hypothesis, not a new one',
          hypothesisMatches,
          hypothesisMatches
            ? `Measured: ${benefit?.measuredValue} ${benefit?.unit} against baseline ${benefit?.baseline}.`
            : 'The measured hypothesis does not match the one committed at Stage 2.',
        ),
        criterion(
          'value-state-declared',
          'Value is declared realised, not realised, or not yet measurable',
          !!benefit?.state,
          benefit ? `State: ${benefit.state}.` : 'No value state declared.',
        ),
        criterion(
          'telemetry-recorded',
          'Usage telemetry has been recorded',
          !!telemetry && !!telemetry.lastUsedAt,
          telemetry?.lastUsedAt
            ? `${telemetry.consumers} consumer(s), last used ${telemetry.lastUsedAt}.`
            : 'No usage telemetry recorded.',
        ),
        commentsCriterion(ctx),
      ]
    },
  },
]

const BY_NUMBER = new Map(STAGES.map((s) => [s.number, s]))

export function getStage(number: number): StageDefinition {
  const stage = BY_NUMBER.get(number)
  if (!stage) throw new Error(`Unknown stage: ${number}`)
  return stage
}

export function stageExists(number: number): boolean {
  return BY_NUMBER.has(number)
}

export const FIRST_STAGE = 1
export const LAST_STAGE = STAGES.length

/** Which roles approve which stages — computed, never typed by hand. */
export function raciMatrix(): {
  role: RoleKey
  approves: number[]
  vetoes: number[]
}[] {
  const roles = new Map<RoleKey, { approves: number[]; vetoes: number[] }>()
  for (const stage of STAGES) {
    for (const role of stage.approverRoles) {
      const entry = roles.get(role) ?? { approves: [], vetoes: [] }
      entry.approves.push(stage.number)
      roles.set(role, entry)
    }
    for (const role of stage.vetoRoles) {
      const entry = roles.get(role) ?? { approves: [], vetoes: [] }
      entry.vetoes.push(stage.number)
      roles.set(role, entry)
    }
  }
  return [...roles.entries()].map(([role, v]) => ({ role, ...v }))
}
