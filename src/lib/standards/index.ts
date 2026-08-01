/**
 * Standards interoperability.
 *
 * Honest scope statement, repeated in the README and in the Admin UI: each adapter pins the
 * specification version it was written against and is covered by a round-trip or shape test in
 * `tests/standards.test.ts`. That is what "conformance" means here — the mapping is stable and
 * tested, not that it has been certified against a live published specification. Before relying on
 * one of these in production, check the pinned version against the current published spec.
 */

export interface StandardsAdapter {
  key: string
  name: string
  version: string
  direction: 'ROUND_TRIP' | 'EXPORT_ONLY'
  note: string
}

export const STANDARDS_ADAPTERS: StandardsAdapter[] = [
  {
    key: 'odcs',
    name: 'Open Data Contract Standard (ODCS)',
    version: 'v3.0.x',
    direction: 'ROUND_TRIP',
    note: 'Imports and exports data-contract.yaml. Round-trip tested on schema, SLAs and versioning.',
  },
  {
    key: 'odps',
    name: 'Open Data Product Specification (ODPS)',
    version: 'v3.x',
    direction: 'EXPORT_ONLY',
    note: 'Product descriptor export assembled from charter, listing and contract.',
  },
  {
    key: 'dcat',
    name: 'DCAT / DCAT-AP',
    version: 'DCAT 3 (JSON-LD)',
    direction: 'EXPORT_ONLY',
    note: 'Catalogue interchange for public-sector and federated catalogues.',
  },
  {
    key: 'openlineage',
    name: 'OpenLineage',
    version: '2-0-2 run event',
    direction: 'EXPORT_ONLY',
    note: 'Emits a COMPLETE run event with input and output datasets from the physical architecture.',
  },
  {
    key: 'metricflow',
    name: 'MetricFlow / dbt semantic manifest',
    version: 'semantic manifest v1',
    direction: 'ROUND_TRIP',
    note: 'Semantic model round-trip on entities, dimensions and metrics.',
  },
  {
    key: 'schema-org',
    name: 'schema.org Dataset',
    version: 'schema.org 27.x',
    direction: 'EXPORT_ONLY',
    note: 'Marketplace listing markup for discoverability.',
  },
  {
    key: 'catalog',
    name: 'OpenMetadata / DataHub listing shape',
    version: 'listing export shape',
    direction: 'EXPORT_ONLY',
    note: 'Export only. There is deliberately no live sync — this tool does not own your catalogue.',
  },
]

export * from './contracts'
export * from './catalogue'
export * from './semantics'
