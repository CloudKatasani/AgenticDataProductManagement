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
  /**
   * Present only where the pinned shape has actually been checked against the published
   * specification. Absent means unverified — and the UI says so rather than implying otherwise.
   */
  verification?: { checkedOn: string; source: string; finding: string }
}

export const STANDARDS_ADAPTERS: StandardsAdapter[] = [
  {
    key: 'odcs',
    name: 'Open Data Contract Standard (ODCS)',
    version: 'v3.0.2',
    direction: 'ROUND_TRIP',
    note: 'Imports and exports data-contract.yaml. Round-trip tested on schema, SLAs and versioning.',
    verification: {
      checkedOn: '2026-08-01',
      source: 'bitol-io/open-data-contract-standard — schema/odcs-json-schema-latest.json',
      finding:
        'v3.0.2 is an accepted apiVersion enum value; v3.1.0 is the published default. The five required root fields (apiVersion, kind, id, version, status) are all emitted, so the payload is valid against the 3.0.x line. Moving the pin to v3.1.0 has not been attempted.',
    },
  },
  {
    key: 'odps',
    name: 'Open Data Product Specification (ODPS)',
    version: 'v3.0',
    direction: 'EXPORT_ONLY',
    note: 'Product descriptor export assembled from charter, listing and contract. Shape unverified against the published specification.',
  },
  {
    key: 'dcat',
    name: 'DCAT / DCAT-AP',
    version: 'DCAT 3 (JSON-LD)',
    direction: 'EXPORT_ONLY',
    note: 'Catalogue interchange for public-sector and federated catalogues. Shape unverified against the published specification.',
  },
  {
    key: 'openlineage',
    name: 'OpenLineage',
    version: '2-0-2 run event',
    direction: 'EXPORT_ONLY',
    note: 'Emits a COMPLETE run event with input and output datasets from the physical architecture.',
    verification: {
      checkedOn: '2026-08-01',
      source: 'OpenLineage/OpenLineage — spec/OpenLineage.json',
      finding:
        'The spec $id is https://openlineage.io/spec/2-0-2/OpenLineage.json, matching the pin. A RunEvent requires eventTime, producer, schemaURL, run and job; eventType, inputs and outputs are optional. All are emitted.',
    },
  },
  {
    key: 'metricflow',
    name: 'MetricFlow / dbt semantic manifest',
    version: 'semantic manifest v1',
    direction: 'ROUND_TRIP',
    note: 'Semantic model round-trip on entities, dimensions and metrics. Shape unverified against the published specification.',
  },
  {
    key: 'schema-org',
    name: 'schema.org Dataset',
    version: 'schema.org 27.x',
    direction: 'EXPORT_ONLY',
    note: 'Marketplace listing markup for discoverability. Shape unverified against the published vocabulary.',
  },
  {
    key: 'catalog',
    name: 'OpenMetadata / DataHub listing shape',
    version: 'listing export shape',
    direction: 'EXPORT_ONLY',
    note: 'Export only. There is deliberately no live sync — this tool does not own your catalogue. Field names follow the OpenMetadata/DataHub conventions but are unverified against either published entity schema.',
  },
]

export * from './contracts'
export * from './catalogue'
export * from './semantics'
