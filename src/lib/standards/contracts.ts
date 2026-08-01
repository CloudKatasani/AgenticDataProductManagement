import type { Charter, DataContract, MarketplaceListing } from '@/lib/artifacts/registry'

/** ODCS v3.0.x. Version pinned in STANDARDS_ADAPTERS and asserted in tests/standards.test.ts. */
export const ODCS_VERSION = 'v3.0.2'

export interface OdcsContract {
  apiVersion: string
  kind: 'DataContract'
  id: string
  version: string
  status: string
  name: string
  description: { purpose: string }
  schema: {
    name: string
    physicalType: 'table'
    properties: {
      name: string
      logicalType: string
      required: boolean
      description: string
    }[]
  }[]
  slaProperties: { property: string; value: number | string; unit?: string }[]
  support: { channel: string; url: string }[]
  customProperties: { property: string; value: string | number }[]
}

export function toOdcs(params: {
  id: string
  name: string
  version: string
  status: string
  purpose: string
  contract: DataContract
}): OdcsContract {
  return {
    apiVersion: ODCS_VERSION,
    kind: 'DataContract',
    id: params.id,
    version: params.version,
    status: params.status,
    name: params.name,
    description: { purpose: params.purpose },
    schema: [
      {
        name: params.name,
        physicalType: 'table',
        properties: params.contract.schemaColumns.map((column) => ({
          name: column.name,
          logicalType: column.datatype,
          required: !column.nullable,
          description: column.description,
        })),
      },
    ],
    slaProperties: [
      { property: 'frequency', value: params.contract.slas.freshnessMinutes, unit: 'minutes' },
      { property: 'availability', value: params.contract.slas.availabilityPct, unit: 'percent' },
      { property: 'maxNullRate', value: params.contract.slas.maxNullRatePct, unit: 'percent' },
    ],
    support: [{ channel: params.contract.support.channel || 'owner', url: 'mailto:' }],
    customProperties: [
      { property: 'versioningPolicy', value: params.contract.versioning.policy },
      { property: 'deprecationNoticeDays', value: params.contract.versioning.deprecationNoticeDays },
      { property: 'contractOwner', value: params.contract.support.owner },
    ],
  }
}

/** The inverse mapping, so ODCS support is a round trip rather than a one-way claim. */
export function fromOdcs(document: OdcsContract): DataContract {
  const schema = document.schema[0]
  const sla = (property: string): number => {
    const entry = document.slaProperties.find((s) => s.property === property)
    return typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? 0)
  }
  const custom = (property: string): string => {
    const entry = document.customProperties.find((c) => c.property === property)
    return entry ? String(entry.value) : ''
  }
  return {
    schemaColumns: (schema?.properties ?? []).map((property) => ({
      name: property.name,
      datatype: property.logicalType,
      nullable: !property.required,
      description: property.description,
    })),
    slas: {
      freshnessMinutes: sla('frequency'),
      availabilityPct: sla('availability'),
      maxNullRatePct: sla('maxNullRate'),
    },
    versioning: {
      policy: custom('versioningPolicy'),
      deprecationNoticeDays: Number(custom('deprecationNoticeDays') || 0),
    },
    support: {
      owner: custom('contractOwner'),
      channel: document.support[0]?.channel ?? '',
    },
  }
}

export const ODPS_VERSION = '3.0'

export interface OdpsProduct {
  schema: string
  version: string
  product: {
    en: {
      name: string
      productID: string
      status: string
      description: { en: string }
      productSeries: string
      type: string
      categories: string[]
      dataAccess: { type: string; authenticationMethod: string }
      dataQuality: { dimension: string; displayTitle: string; objective: number; unit: string }[]
      SLA: { dimension: string; objective: number; unit: string }[]
      pricingPlans: { name: string; priceCurrency: string; price: number; billingDuration: string }[]
    }
  }
}

export function toOdps(params: {
  productKey: string
  status: string
  charter: Charter
  listing: MarketplaceListing
  contract: DataContract
}): OdpsProduct {
  return {
    schema: `https://opendataproducts.org/v${ODPS_VERSION}/schema/odps.json`,
    version: ODPS_VERSION,
    product: {
      en: {
        name: params.listing.headline,
        productID: params.productKey,
        status: params.status.toLowerCase(),
        description: { en: params.listing.description },
        productSeries: params.listing.domain,
        type: params.charter.archetype,
        categories: [params.listing.domain, params.charter.tier],
        dataAccess: {
          type: params.listing.accessTier === 'OPEN' ? 'open' : 'requestAccess',
          authenticationMethod: 'workspace-session',
        },
        dataQuality: [
          {
            dimension: 'completeness',
            displayTitle: 'Maximum null rate',
            objective: params.contract.slas.maxNullRatePct,
            unit: 'percent',
          },
          {
            dimension: 'availability',
            displayTitle: 'Availability',
            objective: params.contract.slas.availabilityPct,
            unit: 'percent',
          },
        ],
        SLA: [
          {
            dimension: 'freshness',
            objective: params.contract.slas.freshnessMinutes,
            unit: 'minutes',
          },
        ],
        pricingPlans: [
          {
            name: 'Internal showback',
            priceCurrency: 'USD',
            price: params.listing.costToServeUsdPerMonth,
            billingDuration: 'month',
          },
        ],
      },
    },
  }
}
