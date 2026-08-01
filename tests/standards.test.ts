import { describe, expect, it } from 'vitest'
import {
  METRICFLOW_VERSION,
  ODCS_REQUIRED_ROOT_FIELDS,
  ODCS_VERSION,
  OPENLINEAGE_VERSION,
  STANDARDS_ADAPTERS,
  fromMetricFlow,
  fromOdcs,
  toCatalogEntity,
  toDcat,
  toMetricFlow,
  toOdcs,
  toOdps,
  toOpenLineage,
  toSchemaOrg,
} from '@/lib/standards'
import {
  dataContractSchema,
  marketplaceListingSchema,
  semanticModelSchema,
  type Charter,
} from '@/lib/artifacts/registry'

const contract = dataContractSchema.parse({
  schemaColumns: [
    { name: 'account_id', datatype: 'string', nullable: false, description: 'The account identifier' },
    { name: 'arrears_balance', datatype: 'decimal', nullable: true, description: 'Overdue balance' },
  ],
  slas: { freshnessMinutes: 1440, availabilityPct: 99.5, maxNullRatePct: 8 },
  versioning: { policy: 'Semantic versioning', deprecationNoticeDays: 90 },
  support: { owner: 'Marcus Bell', channel: '#data-product-support' },
})

const semantic = semanticModelSchema.parse({
  entities: [{ name: 'Account', primaryEntity: true, description: 'Billing account' }],
  dimensions: [{ name: 'reporting_date', type: 'TIME', expression: "date_trunc('day', event_ts)" }],
  joins: [],
  metrics: [
    {
      name: 'arrears_balance',
      label: 'Arrears balance',
      definition: 'Overdue balance across accounts',
      expression: 'sum(arrears_balance)',
      grain: 'account',
      tracesToQuestions: ['Which accounts crossed 60 days in arrears this week?'],
      owner: 'Priya Raman',
    },
  ],
})

const listing = marketplaceListingSchema.parse({
  headline: 'Arrears and customer protection',
  description: 'A single view of account arrears with protected-status enforcement built in.',
  owner: 'Marcus Bell',
  steward: 'Priya Raman',
  domain: 'Credit & Collections',
  lineageSummary: 'Billing + CIS → gold_arrears → semantic',
  qualityScore: 94,
  freshness: 'Daily by 07:00',
  accessTier: 'RESTRICTED',
  costToServeUsdPerMonth: 480,
  sampleQuestions: ['Which accounts crossed 60 days in arrears this week?'],
  sampleQueries: ['SELECT arrears_balance FROM arrears_semantic'],
  supportedPatterns: ['certified-dashboard'],
  entities: ['Account', 'Customer'],
})

const charter: Charter = {
  purpose: 'Unblock the weekly collections decision',
  archetype: 'ENTITY_MASTER',
  tier: 'CONSUMER_ALIGNED',
  inScope: ['Account records'],
  outOfScope: ['Real-time streaming'],
  targetPatterns: ['certified-dashboard'],
  stakeholders: [{ role: 'DOMAIN_PRODUCT_OWNER', name: 'Marcus Bell' }],
}

describe('standards adapters', () => {
  it('pins a specification version for every adapter', () => {
    for (const adapter of STANDARDS_ADAPTERS) {
      expect(adapter.version).toBeTruthy()
      expect(adapter.note).toBeTruthy()
      // An adapter either carries a real verification record, or says plainly it has none.
      if (adapter.verification) {
        expect(adapter.verification.source).toBeTruthy()
        expect(adapter.verification.finding).toBeTruthy()
        expect(adapter.verification.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      } else {
        expect(adapter.note.toLowerCase()).toContain('unverified')
      }
    }
    expect(ODCS_VERSION).toMatch(/^v3\./)
    expect(METRICFLOW_VERSION).toBe('semantic-manifest-v1')
    expect(OPENLINEAGE_VERSION).toBe('2-0-2')
  })

  it('emits every root field the published ODCS schema marks as required', () => {
    const odcs = toOdcs({
      id: 'arrears-and-protection',
      name: 'Arrears & Customer Protection',
      version: '1.0.0',
      status: 'published',
      purpose: 'Unblock the weekly collections decision',
      contract,
    })
    for (const field of ODCS_REQUIRED_ROOT_FIELDS) {
      expect(odcs[field as keyof typeof odcs], field).toBeTruthy()
    }
    // A support entry needs a reachable URL, not a placeholder.
    expect(odcs.support[0]?.url).toMatch(/^(chat|contact):/)
  })

  it('round-trips a data contract through ODCS without losing meaning', () => {
    const odcs = toOdcs({
      id: 'arrears-and-protection',
      name: 'Arrears & Customer Protection',
      version: '1.0.0',
      status: 'published',
      purpose: 'Unblock the weekly collections decision',
      contract,
    })
    expect(odcs.apiVersion).toBe(ODCS_VERSION)
    const back = fromOdcs(odcs)
    expect(dataContractSchema.parse(back)).toEqual(contract)
  })

  it('round-trips a semantic model through the MetricFlow manifest', () => {
    const manifest = toMetricFlow(semantic, 'arrears')
    expect(manifest.manifest_version).toBe(METRICFLOW_VERSION)
    const back = fromMetricFlow(manifest)
    expect(back.metrics).toEqual(semantic.metrics)
    expect(back.entities).toEqual([{ name: 'Account', primaryEntity: true, description: '' }])
    expect(back.dimensions).toEqual(semantic.dimensions)
  })

  it('produces DCAT JSON-LD with the expected context and access rights', () => {
    const dcat = toDcat({
      productKey: 'arrears',
      listing,
      publisherName: 'Utility & Energy Workspace',
      publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    expect(dcat['@type']).toBe('dcat:Dataset')
    expect(dcat['@context'].dcat).toBe('http://www.w3.org/ns/dcat#')
    expect(dcat['dct:accessRights']).toContain('RESTRICTED')
    expect(dcat['dcat:distribution']).toHaveLength(1)
  })

  it('produces an ODPS descriptor with SLA and quality objectives', () => {
    const odps = toOdps({ productKey: 'arrears', status: 'PUBLISHED', charter, listing, contract })
    expect(odps.product.en.productID).toBe('arrears')
    expect(odps.product.en.SLA[0]?.objective).toBe(1440)
    expect(odps.product.en.dataQuality.map((entry) => entry.dimension)).toContain('availability')
  })

  it('emits an OpenLineage COMPLETE event from the physical architecture', () => {
    const event = toOpenLineage({
      runId: 'run-1',
      namespace: 'utility-energy',
      jobName: 'arrears',
      eventTime: '2026-08-01T00:00:00.000Z',
      description: 'Arrears product',
      architecture: {
        platformProfile: 'Snowflake',
        ingestionPattern: 'Batch',
        orchestration: 'Task graph',
        schedule: 'Daily',
        refreshStrategy: 'Incremental',
        layers: { bronze: ['bronze_billing'], silver: ['silver_arrears'], gold: ['gold_arrears'] },
        attributeLayerMap: [],
      },
    })
    expect(event.eventType).toBe('COMPLETE')
    expect(event.schemaURL).toContain(OPENLINEAGE_VERSION)
    expect(event.inputs.map((input) => input.name)).toEqual(['bronze_billing'])
    expect(event.outputs.map((output) => output.name)).toEqual(['gold_arrears'])
  })

  it('produces schema.org and catalogue shapes from the listing', () => {
    const schemaOrg = toSchemaOrg({
      listing,
      metrics: semantic.metrics.map((metric) => ({ name: metric.name, definition: metric.definition })),
      publisherName: 'Utility & Energy Workspace',
    })
    expect(schemaOrg['@type']).toBe('Dataset')
    expect(schemaOrg.isAccessibleForFree).toBe(false)
    expect(schemaOrg.variableMeasured[0]?.name).toBe('arrears_balance')

    const entity = toCatalogEntity({ productKey: 'arrears', listing })
    expect(entity.entityType).toBe('dataset')
    expect(entity.owners.map((owner) => owner.name)).toContain('Priya Raman')
  })
})
