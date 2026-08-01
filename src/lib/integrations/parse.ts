import { parseCsv } from '@/lib/profiling/csv'
import {
  emptyExternalMetadata,
  externalMetadataSchema,
  type ExternalMetadata,
  type ExternalEntity,
} from './schema'

/**
 * Per-tool parsers. Each maps a documented export shape onto the canonical schema; the canonical
 * format has no mapping at all. Everything ends up validated by `externalMetadataSchema`, so a
 * parser that produces nonsense fails here rather than in an agent's context.
 */

export class ImportError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ImportError(
      `That is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
    )
  }
}

/** Case- and space-insensitive header lookup, because export templates vary. */
function column(row: Record<string, string>, ...candidates: string[]): string {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const map = new Map(Object.entries(row).map(([k, v]) => [normalise(k), v]))
  for (const candidate of candidates) {
    const value = map.get(normalise(candidate))
    if (value !== undefined && value !== '') return value.trim()
  }
  return ''
}

function truthy(value: string): boolean {
  return ['y', 'yes', 'true', '1', 'pk', 'primary key', 'not null'].includes(value.toLowerCase())
}

/**
 * erwin Data Modeler — Bulk Editor / Report Designer CSV.
 *
 * One row per attribute, entity repeated. Relationship rows are recognised by carrying a parent
 * and child entity instead of an attribute, so a single combined export works too.
 */
export function parseErwinCsv(text: string): ExternalMetadata {
  const { headers, rows: dataRows } = parseCsv(text)
  if (dataRows.length === 0) throw new ImportError('The erwin export has no rows.')
  const rows = dataRows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  )

  const metadata = emptyExternalMetadata()
  const entities = new Map<string, ExternalEntity>()

  for (const row of rows) {
    const parent = column(row, 'Parent Entity', 'ParentEntity', 'Parent')
    const child = column(row, 'Child Entity', 'ChildEntity', 'Child')
    if (parent && child) {
      const cardinality = column(row, 'Cardinality', 'Relationship Type', 'Type').toLowerCase()
      metadata.relationships.push({
        from: parent,
        to: child,
        cardinality: cardinality.includes('many to many')
          ? 'MANY_TO_MANY'
          : cardinality.includes('one to one')
            ? 'ONE_TO_ONE'
            : 'ONE_TO_MANY',
        description: column(row, 'Relationship Name', 'Verb Phrase', 'Description'),
      })
      continue
    }

    const entityName = column(row, 'Entity', 'Entity Name', 'Table', 'Table Name')
    if (!entityName) continue
    const entity = entities.get(entityName) ?? {
      name: entityName,
      description: column(row, 'Entity Definition', 'Entity Description', 'Definition'),
      attributes: [],
    }
    entities.set(entityName, entity)

    const attributeName = column(row, 'Attribute', 'Attribute Name', 'Column', 'Column Name')
    if (!attributeName) continue
    entity.attributes.push({
      name: attributeName,
      datatype: column(row, 'Datatype', 'Data Type', 'Physical Data Type', 'Domain'),
      // erwin writes "NOT NULL" / "NULL" in the Null Option column.
      nullable: !truthy(column(row, 'Null Option', 'Nullable', 'Null')),
      isKey: truthy(column(row, 'Primary Key', 'PK', 'Key Type')),
      description: column(row, 'Attribute Definition', 'Attribute Description', 'Comment'),
    })
  }

  metadata.entities = [...entities.values()]
  if (metadata.entities.length === 0 && metadata.relationships.length === 0) {
    throw new ImportError(
      'No entities or relationships were recognised.',
      ['Expected an Entity column, or a Parent Entity and Child Entity pair. Column headings vary by erwin report template — check yours against the export instructions.'],
    )
  }
  return externalMetadataSchema.parse(metadata)
}

interface CollibraAsset {
  name?: string
  displayName?: string
  type?: string | { name?: string }
  description?: string
  status?: string | { name?: string }
  steward?: string
  owner?: string
  attributes?: Record<string, unknown>
  relations?: { target?: string; name?: string }[]
}

function nameOf(value: string | { name?: string } | undefined): string {
  if (!value) return ''
  return typeof value === 'string' ? value : (value.name ?? '')
}

/** Collibra — asset export JSON (an array of assets, or `{ results: [...] }`). */
export function parseCollibraJson(text: string): ExternalMetadata {
  const raw = readJson(text)
  const assets: CollibraAsset[] = Array.isArray(raw)
    ? (raw as CollibraAsset[])
    : (((raw as { results?: CollibraAsset[] })?.results ?? []) as CollibraAsset[])
  if (assets.length === 0) {
    throw new ImportError('No assets found.', ['Expected a JSON array of assets, or an object with a "results" array.'])
  }

  const metadata = emptyExternalMetadata()
  for (const asset of assets) {
    const name = (asset.displayName || asset.name || '').trim()
    if (!name) continue
    const type = nameOf(asset.type).toLowerCase()
    const status = nameOf(asset.status)
    const steward = (asset.steward || asset.owner || '').trim()

    if (type.includes('term') || type.includes('glossary')) {
      metadata.glossary.push({
        term: name,
        definition: asset.description ?? '',
        steward,
        status,
        mappedAssets: (asset.relations ?? []).map((r) => r.target ?? '').filter(Boolean),
      })
    } else if (type.includes('metric') || type.includes('kpi')) {
      metadata.metrics.push({
        name,
        definition: asset.description ?? '',
        expression: String(asset.attributes?.expression ?? ''),
        owner: steward,
        externalCertification: status,
      })
    } else {
      metadata.sources.push({
        name,
        system: String(asset.attributes?.system ?? nameOf(asset.type)),
        description: asset.description ?? '',
        owner: steward,
        externalCertification: status,
        layer: 'UNKNOWN',
      })
    }
  }
  return externalMetadataSchema.parse(metadata)
}

interface AlationTable {
  name?: string
  title?: string
  description?: string
  ds_name?: string
  data_source?: string
  owner?: string
  steward?: string
  endorsement?: string
  row_count?: number
  columns?: {
    name?: string
    data_type?: string
    type?: string
    null_percent?: number
    distinct_count?: number
    min?: unknown
    max?: unknown
    classification?: string
  }[]
}

interface AlationExport {
  tables?: AlationTable[]
  terms?: { title?: string; name?: string; description?: string; steward?: string; status?: string }[]
}

/** Alation — bulk metadata JSON: tables with columns, plus glossary terms. */
export function parseAlationJson(text: string): ExternalMetadata {
  const raw = readJson(text) as AlationExport | AlationTable[]
  const payload: AlationExport = Array.isArray(raw) ? { tables: raw } : raw
  const tables = payload.tables ?? []
  const terms = payload.terms ?? []
  if (tables.length === 0 && terms.length === 0) {
    throw new ImportError('No tables or terms found.', ['Expected {"tables": [...]} or {"terms": [...]}, or a bare array of tables.'])
  }

  const metadata = emptyExternalMetadata()
  for (const table of tables) {
    const name = (table.title || table.name || '').trim()
    if (!name) continue
    metadata.sources.push({
      name,
      system: table.ds_name || table.data_source || '',
      description: table.description ?? '',
      owner: table.steward || table.owner || '',
      externalCertification: table.endorsement ?? '',
      rowCountEstimate: typeof table.row_count === 'number' ? Math.max(0, Math.trunc(table.row_count)) : undefined,
      layer: 'UNKNOWN',
    })
    for (const col of table.columns ?? []) {
      const columnName = (col.name ?? '').trim()
      if (!columnName) continue
      metadata.columnProfiles.push({
        source: name,
        column: columnName,
        datatype: col.data_type || col.type || '',
        nullRatePct:
          typeof col.null_percent === 'number' ? Math.min(100, Math.max(0, col.null_percent)) : undefined,
        distinctCount:
          typeof col.distinct_count === 'number' ? Math.max(0, Math.trunc(col.distinct_count)) : undefined,
        min: col.min === undefined || col.min === null ? '' : String(col.min),
        max: col.max === undefined || col.max === null ? '' : String(col.max),
        classification: col.classification ?? '',
      })
    }
  }
  for (const term of terms) {
    const title = (term.title || term.name || '').trim()
    if (!title) continue
    metadata.glossary.push({
      term: title,
      definition: term.description ?? '',
      steward: term.steward ?? '',
      status: term.status ?? '',
      mappedAssets: [],
    })
  }
  return externalMetadataSchema.parse(metadata)
}

/** The canonical format: validated, never mapped. */
export function parseCanonicalJson(text: string): ExternalMetadata {
  const parsed = externalMetadataSchema.safeParse(readJson(text))
  if (!parsed.success) {
    throw new ImportError(
      'The file does not match the canonical import schema.',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    )
  }
  return parsed.data
}

export function parseImport(connectorKey: string, text: string): ExternalMetadata {
  switch (connectorKey) {
    case 'adpm-json':
      return parseCanonicalJson(text)
    case 'erwin-csv':
      return parseErwinCsv(text)
    case 'collibra-json':
      return parseCollibraJson(text)
    case 'alation-json':
      return parseAlationJson(text)
    default:
      throw new ImportError(`Unknown connector: ${connectorKey}`)
  }
}

/** A one-line summary for the import list and the audit event. */
export function summariseImport(metadata: ExternalMetadata): string {
  const parts: string[] = []
  if (metadata.sources.length) parts.push(`${metadata.sources.length} source(s)`)
  if (metadata.columnProfiles.length) parts.push(`${metadata.columnProfiles.length} column profile(s)`)
  if (metadata.entities.length) parts.push(`${metadata.entities.length} entity/entities`)
  if (metadata.relationships.length) parts.push(`${metadata.relationships.length} relationship(s)`)
  if (metadata.glossary.length) parts.push(`${metadata.glossary.length} glossary term(s)`)
  if (metadata.metrics.length) parts.push(`${metadata.metrics.length} metric(s)`)
  return parts.length ? parts.join(', ') : 'nothing recognised'
}
