import type { MarketplaceListing } from '@/lib/artifacts/registry'

/** DCAT 3, JSON-LD serialisation. */
export const DCAT_VERSION = 'DCAT-3'

export interface DcatDataset {
  '@context': Record<string, string>
  '@type': 'dcat:Dataset'
  '@id': string
  'dct:title': string
  'dct:description': string
  'dct:publisher': { '@type': 'foaf:Organization'; 'foaf:name': string }
  'dct:accrualPeriodicity': string
  'dcat:theme': string[]
  'dcat:keyword': string[]
  'dct:accessRights': string
  'dcat:distribution': {
    '@type': 'dcat:Distribution'
    'dct:title': string
    'dcat:accessService': string
  }[]
  'dct:issued'?: string
}

export function toDcat(params: {
  productKey: string
  listing: MarketplaceListing
  publisherName: string
  publishedAt?: Date | null
  baseUri?: string
}): DcatDataset {
  const base = params.baseUri ?? 'urn:adpm:product'
  return {
    '@context': {
      dcat: 'http://www.w3.org/ns/dcat#',
      dct: 'http://purl.org/dc/terms/',
      foaf: 'http://xmlns.com/foaf/0.1/',
    },
    '@type': 'dcat:Dataset',
    '@id': `${base}:${params.productKey}`,
    'dct:title': params.listing.headline,
    'dct:description': params.listing.description,
    'dct:publisher': { '@type': 'foaf:Organization', 'foaf:name': params.publisherName },
    'dct:accrualPeriodicity': params.listing.freshness,
    'dcat:theme': [params.listing.domain],
    'dcat:keyword': params.listing.entities,
    'dct:accessRights':
      params.listing.accessTier === 'OPEN'
        ? 'http://publications.europa.eu/resource/authority/access-right/PUBLIC'
        : 'http://publications.europa.eu/resource/authority/access-right/RESTRICTED',
    'dcat:distribution': params.listing.supportedPatterns.map((pattern) => ({
      '@type': 'dcat:Distribution' as const,
      'dct:title': pattern,
      'dcat:accessService': `${base}:${params.productKey}:${pattern}`,
    })),
    ...(params.publishedAt ? { 'dct:issued': params.publishedAt.toISOString() } : {}),
  }
}

/** schema.org Dataset markup, for marketplace discoverability. */
export const SCHEMA_ORG_VERSION = 'schema.org/27.0'

export interface SchemaOrgDataset {
  '@context': 'https://schema.org'
  '@type': 'Dataset'
  name: string
  description: string
  creator: { '@type': 'Organization'; name: string }
  keywords: string[]
  license: string
  isAccessibleForFree: boolean
  variableMeasured: { '@type': 'PropertyValue'; name: string; description: string }[]
}

export function toSchemaOrg(params: {
  listing: MarketplaceListing
  metrics: { name: string; definition: string }[]
  publisherName: string
}): SchemaOrgDataset {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: params.listing.headline,
    description: params.listing.description,
    creator: { '@type': 'Organization', name: params.publisherName },
    keywords: [...params.listing.entities, params.listing.domain],
    license: 'internal-use-only',
    isAccessibleForFree: params.listing.accessTier === 'OPEN',
    variableMeasured: params.metrics.map((metric) => ({
      '@type': 'PropertyValue' as const,
      name: metric.name,
      description: metric.definition,
    })),
  }
}

/**
 * OpenMetadata / DataHub listing export. Export only, deliberately: this tool does not own your
 * catalogue and will not pretend to keep one in sync.
 */
export interface CatalogEntity {
  entityType: 'dataset'
  name: string
  displayName: string
  description: string
  owners: { name: string; type: 'user' }[]
  tags: string[]
  domain: string
  properties: {
    qualityScore: number
    freshness: string
    accessTier: string
    costToServeUsdPerMonth: number
    supportedPatterns: string[]
  }
}

export function toCatalogEntity(params: {
  productKey: string
  listing: MarketplaceListing
}): CatalogEntity {
  return {
    entityType: 'dataset',
    name: params.productKey,
    displayName: params.listing.headline,
    description: params.listing.description,
    owners: [
      { name: params.listing.owner, type: 'user' },
      { name: params.listing.steward, type: 'user' },
    ],
    tags: params.listing.entities,
    domain: params.listing.domain,
    properties: {
      qualityScore: params.listing.qualityScore,
      freshness: params.listing.freshness,
      accessTier: params.listing.accessTier,
      costToServeUsdPerMonth: params.listing.costToServeUsdPerMonth,
      supportedPatterns: params.listing.supportedPatterns,
    },
  }
}
