import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { AGENTS, getAgent } from '@/lib/agents/registry'
import { invokeAgent, loadExternalMetadata } from '@/lib/agents/runtime'
import { CONNECTORS, getConnector } from '@/lib/integrations/registry'
import {
  ImportError,
  parseAlationJson,
  parseCanonicalJson,
  parseCollibraJson,
  parseErwinCsv,
  summariseImport,
} from '@/lib/integrations/parse'
import {
  EXTERNAL_CONTEXT_KINDS,
  emptyExternalMetadata,
  mergeExternalMetadata,
  scopeExternalMetadata,
} from '@/lib/integrations/schema'
import { contentHash } from '@/lib/hash'
import { createFixture, createProduct } from './helpers/fixtures'

afterAll(async () => {
  await prisma.$disconnect()
})

const ERWIN_CSV = [
  'Entity,Entity Definition,Attribute,Datatype,Null Option,Primary Key,Attribute Definition',
  'Account,A billing account,account_id,INTEGER,NOT NULL,PK,Surrogate key',
  'Account,A billing account,arrears_balance,DECIMAL(12;2),NULL,,Overdue balance',
  'Customer,A billing customer,customer_id,INTEGER,NOT NULL,PK,Surrogate key',
].join('\n')

const ERWIN_RELATIONSHIPS = [
  'Parent Entity,Child Entity,Cardinality,Relationship Name',
  'Customer,Account,One to Many,holds',
].join('\n')

const COLLIBRA_JSON = JSON.stringify({
  results: [
    {
      displayName: 'Arrears Balance',
      type: { name: 'Business Term' },
      description: 'Overdue balance across accounts',
      steward: 'Priya Raman',
      status: { name: 'Approved' },
      relations: [{ target: 'gold_arrears' }],
    },
    {
      displayName: 'gold_arrears',
      type: { name: 'Table' },
      description: 'Curated arrears table',
      owner: 'Marcus Bell',
      status: { name: 'Certified' },
      attributes: { system: 'Snowflake' },
    },
    {
      displayName: 'Days In Arrears',
      type: { name: 'Metric' },
      description: 'Days since the account fell overdue',
      status: { name: 'Endorsed' },
      attributes: { expression: 'datediff(day, overdue_from, current_date)' },
    },
  ],
})

const ALATION_JSON = JSON.stringify({
  tables: [
    {
      title: 'billing.accounts',
      ds_name: 'Snowflake PROD',
      description: 'Account master',
      steward: 'Marcus Bell',
      endorsement: 'endorsed',
      row_count: 1_250_000,
      columns: [
        { name: 'account_id', data_type: 'number', null_percent: 0, distinct_count: 1250000 },
        {
          name: 'email',
          data_type: 'varchar',
          null_percent: 4.2,
          distinct_count: 1180000,
          classification: 'PII',
        },
        // Above the 5% flag threshold, so the null-rate rule actually fires.
        { name: 'secondary_phone', data_type: 'varchar', null_percent: 31.7, distinct_count: 402000 },
      ],
    },
  ],
  terms: [{ title: 'Protected Customer', description: 'A customer with a protection flag', status: 'Approved' }],
})

describe('external metadata parsers', () => {
  it('maps an erwin entity/attribute export onto entities with keys and nullability', () => {
    const metadata = parseErwinCsv(ERWIN_CSV)
    expect(metadata.entities.map((e) => e.name)).toEqual(['Account', 'Customer'])
    const account = metadata.entities[0]!
    expect(account.description).toBe('A billing account')
    expect(account.attributes).toHaveLength(2)
    expect(account.attributes[0]).toMatchObject({ name: 'account_id', isKey: true, nullable: false })
    expect(account.attributes[1]).toMatchObject({ name: 'arrears_balance', isKey: false, nullable: true })
  })

  it('recognises erwin relationship rows and their cardinality', () => {
    const metadata = parseErwinCsv(ERWIN_RELATIONSHIPS)
    expect(metadata.relationships).toEqual([
      { from: 'Customer', to: 'Account', cardinality: 'ONE_TO_MANY', description: 'holds' },
    ])
  })

  it('rejects an erwin file with nothing recognisable rather than importing silence', () => {
    expect(() => parseErwinCsv('Unrelated,Columns\na,b')).toThrow(ImportError)
  })

  it('splits a Collibra export into glossary, metrics and sources by asset type', () => {
    const metadata = parseCollibraJson(COLLIBRA_JSON)
    expect(metadata.glossary.map((t) => t.term)).toEqual(['Arrears Balance'])
    expect(metadata.glossary[0]?.mappedAssets).toEqual(['gold_arrears'])
    expect(metadata.metrics.map((m) => m.name)).toEqual(['Days In Arrears'])
    expect(metadata.sources.map((s) => s.name)).toEqual(['gold_arrears'])
  })

  it("carries a catalogue's own certification verbatim and never as ADPM certification", () => {
    // Invariant 8: certification here cites evidence and an approval recorded in ADPM. Another
    // tool calling an asset "Certified" is that tool's opinion, and must stay labelled as such.
    const metadata = parseCollibraJson(COLLIBRA_JSON)
    expect(metadata.sources[0]?.externalCertification).toBe('Certified')
    expect(Object.keys(metadata.sources[0] ?? {})).not.toContain('certified')
    const alation = parseAlationJson(ALATION_JSON)
    expect(alation.sources[0]?.externalCertification).toBe('endorsed')
  })

  it('maps Alation tables, column profiles and terms', () => {
    const metadata = parseAlationJson(ALATION_JSON)
    expect(metadata.sources[0]).toMatchObject({
      name: 'billing.accounts',
      system: 'Snowflake PROD',
      rowCountEstimate: 1_250_000,
    })
    expect(metadata.columnProfiles).toHaveLength(3)
    expect(metadata.columnProfiles[1]).toMatchObject({
      column: 'email',
      nullRatePct: 4.2,
      classification: 'PII',
    })
    expect(metadata.glossary.map((t) => t.term)).toEqual(['Protected Customer'])
  })

  it('round-trips the canonical format with no mapping layer', () => {
    const source = parseAlationJson(ALATION_JSON)
    const round = parseCanonicalJson(JSON.stringify(source))
    expect(round).toEqual(source)
    expect(contentHash(round)).toBe(contentHash(source))
  })

  it('reports what a malformed canonical file got wrong instead of failing opaquely', () => {
    try {
      parseCanonicalJson(JSON.stringify({ entities: [{ description: 'no name' }] }))
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError)
      expect((error as ImportError).issues.join(' ')).toContain('entities.0.name')
    }
  })

  it('summarises an import for the audit trail', () => {
    expect(summariseImport(parseAlationJson(ALATION_JSON))).toContain('column profile')
    expect(summariseImport(emptyExternalMetadata())).toBe('nothing recognised')
  })
})

describe('external metadata scoping', () => {
  it('gives an agent only the slices it declared', () => {
    const metadata = mergeExternalMetadata([
      parseAlationJson(ALATION_JSON),
      parseErwinCsv(ERWIN_CSV),
    ])
    const scoped = scopeExternalMetadata(metadata, ['glossary'])
    expect(Object.keys(scoped)).toEqual(['glossary'])
    expect(scoped.entities).toBeUndefined()
    expect(scoped.columnProfiles).toBeUndefined()
  })

  it('never gives the grounding agent catalogue or modelling context', () => {
    // Invariant 7: a grounding artifact may reference only certified semantic-layer objects.
    // Catalogue imports are full of physical table names, so the grounding agent must not see
    // them at all. If this fails, a Bronze/Silver table can reach a grounding pack proposal.
    const grounding = getAgent('grounding')
    expect(grounding).toBeDefined()
    expect(grounding!.externalScope ?? []).toEqual([])
  })

  it('declares only known context kinds, on agents that exist', () => {
    for (const agent of AGENTS) {
      for (const kind of agent.externalScope ?? []) {
        expect(EXTERNAL_CONTEXT_KINDS).toContain(kind)
      }
    }
  })

  it('merges imports newest-first so a re-import supersedes rather than duplicates', () => {
    const older = parseCanonicalJson(
      JSON.stringify({ sources: [{ name: 'accounts', description: 'stale' }] }),
    )
    const newer = parseCanonicalJson(
      JSON.stringify({ sources: [{ name: 'accounts', description: 'current' }] }),
    )
    const merged = mergeExternalMetadata([newer, older])
    expect(merged.sources).toHaveLength(1)
    expect(merged.sources[0]?.description).toBe('current')
  })
})

describe('imports reach agents as context, never as artifact content', () => {
  it('puts a declared slice in the agent context and records the external scope on the action', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)

    const metadata = parseAlationJson(ALATION_JSON)
    await prisma.externalMetadataImport.create({
      data: {
        workspaceId: fixture.workspaceId,
        productId: product.id,
        connectorKey: 'alation-json',
        fileName: 'alation.json',
        contentHash: contentHash(metadata),
        payloadJson: JSON.stringify(metadata),
        summary: summariseImport(metadata),
      },
    })

    expect((await loadExternalMetadata(product.id)).columnProfiles).toHaveLength(3)

    const versionsBefore = await prisma.artifactVersion.count()
    const result = await invokeAgent({
      agentId: 'critic',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 1,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })

    // An import is context. It must never become a committed version on its own.
    expect(await prisma.artifactVersion.count()).toBe(versionsBefore)

    // Invariant 6: the declared scope on the action covers external context too.
    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: result.actionId } })
    const scope = JSON.parse(action.scopeJson) as { artifacts: string[]; external: string[] }
    expect(scope.artifacts).toEqual(getAgent('critic')!.readScope)
    expect(scope.external).toEqual(getAgent('critic')!.externalScope)
  })

  it('gives an agent with no declared external scope nothing, even when imports exist', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    const metadata = parseErwinCsv(ERWIN_CSV)
    await prisma.externalMetadataImport.create({
      data: {
        workspaceId: fixture.workspaceId,
        productId: product.id,
        connectorKey: 'erwin-csv',
        contentHash: contentHash(metadata),
        payloadJson: JSON.stringify(metadata),
        summary: summariseImport(metadata),
      },
    })
    const discovery = getAgent('discovery')!
    expect(discovery.externalScope ?? []).toEqual([])
    expect(scopeExternalMetadata(metadata, discovery.externalScope ?? [])).toEqual({})
  })

  it('skips a stored import that no longer validates rather than passing it to a model', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    await prisma.externalMetadataImport.create({
      data: {
        workspaceId: fixture.workspaceId,
        productId: product.id,
        connectorKey: 'adpm-json',
        contentHash: 'x',
        payloadJson: JSON.stringify({ entities: [{ nope: true }] }),
        summary: 'broken',
      },
    })
    await expect(loadExternalMetadata(product.id)).resolves.toEqual(emptyExternalMetadata())
  })
})

describe('connector registry', () => {
  it('is honest about which mappings have been verified', () => {
    for (const connector of CONNECTORS) {
      expect(connector.howToExport.length).toBeGreaterThan(40)
      if (connector.verification) {
        expect(connector.verification.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      } else {
        expect(connector.note.toLowerCase()).toContain('unverified')
      }
      expect(getConnector(connector.key)).toBe(connector)
    }
  })

  it('has no connector that writes back to the external tool', () => {
    // One-way by design: this tool does not own your catalogue, so it cannot corrupt one.
    for (const connector of CONNECTORS) {
      expect(Object.keys(connector)).not.toContain('push')
      expect(Object.keys(connector)).not.toContain('sync')
    }
  })
})

describe('imported context changes what an agent says, offline', () => {
  it('surfaces catalogue findings the agent could not have known otherwise', async () => {
    // The whole point of the feature, and it has to work with no API key: the deterministic
    // local provider must actually read the imported context, or importing changes nothing
    // visible in the configuration most people run.
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)

    const before = await invokeAgent({
      agentId: 'profiling',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 3,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    expect(before.findingCount).toBe(0)

    const metadata = parseAlationJson(ALATION_JSON)
    await prisma.externalMetadataImport.create({
      data: {
        workspaceId: fixture.workspaceId,
        productId: product.id,
        connectorKey: 'alation-json',
        contentHash: contentHash(metadata),
        payloadJson: JSON.stringify(metadata),
        summary: summariseImport(metadata),
      },
    })

    const after = await invokeAgent({
      agentId: 'profiling',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 3,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    expect(after.findingCount).toBeGreaterThan(before.findingCount)

    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: after.actionId } })
    const output = JSON.parse(action.outputJson) as { findings: { title: string; detail: string }[] }
    const titles = output.findings.map((f) => f.title).join(' | ')
    expect(titles).toMatch(/classified in your catalogue/)
    expect(titles).toMatch(/null rate/)

    // Still a proposal-shaped world: findings, not committed content.
    const certification = output.findings.find((f) => f.title.includes('certification'))
    if (certification) {
      expect(certification.detail).toContain('not this product')
    }
  })

  it('runs the same agent unchanged when no import exists', async () => {
    const fixture = await createFixture({ agentsEnabled: true })
    const product = await createProduct(fixture)
    const result = await invokeAgent({
      agentId: 'profiling',
      workspaceId: fixture.workspaceId,
      productId: product.id,
      stageNumber: 3,
      userId: fixture.users.get('DATA_STEWARD')!,
      trigger: 'MANUAL',
    })
    // Guardrail 8: every stage is completable with nothing connected.
    expect(result.findingCount).toBe(0)
    expect(result.proposalCount).toBe(0)
  })
})

describe('connectors are discoverable where agents are configured', () => {
  it('lists every connector the Agents tab renders from the registry', () => {
    // The Agents tab claims every charter, scope, autonomy level and cost is on that page.
    // External context is part of an agent's scope, so the connectors belong there too — this
    // asserts the registry the page renders from is complete, so adding a connector shows up
    // without touching the page.
    const names = CONNECTORS.map((c) => c.name.toLowerCase())
    expect(names.some((n) => n.includes('erwin'))).toBe(true)
    expect(names.some((n) => n.includes('collibra'))).toBe(true)
    expect(names.some((n) => n.includes('alation'))).toBe(true)
    for (const connector of CONNECTORS) {
      expect(connector.supplies.length).toBeGreaterThan(0)
      expect(connector.category).toMatch(/^(DATA_MODELLING|DATA_CATALOGUE|OPEN)$/)
    }
    expect(CONNECTORS.some((c) => c.category === 'DATA_MODELLING')).toBe(true)
    expect(CONNECTORS.some((c) => c.category === 'DATA_CATALOGUE')).toBe(true)
  })

  it('gives every agent a stateable external scope, including an explicit none', () => {
    // Rendered per agent on the Agents tab. An agent with no declared scope must read as a
    // deliberate "none", not as a missing field.
    for (const agent of AGENTS) {
      const scope = agent.externalScope ?? []
      expect(Array.isArray(scope)).toBe(true)
      for (const kind of scope) expect(EXTERNAL_CONTEXT_KINDS).toContain(kind)
    }
    const withScope = AGENTS.filter((a) => (a.externalScope ?? []).length > 0)
    expect(withScope.map((a) => a.id).sort()).toEqual(
      ['architecture', 'critic', 'definition', 'modelling', 'profiling', 'semantic'],
    )
    // Invariant 7 in list form: the Grounding agent is absent and stays absent. A catalogue
    // export is full of physical Bronze and Silver names, and the surest way to keep them out of
    // a grounding pack is for the agent that writes one never to see them.
    expect(withScope.map((a) => a.id)).not.toContain('grounding')
  })
})
