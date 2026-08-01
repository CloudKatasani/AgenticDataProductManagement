import type { PhysicalArchitecture, SemanticModel } from '@/lib/artifacts/registry'

/** dbt / MetricFlow semantic manifest v1 subset — round-tripped in tests/standards.test.ts. */
export const METRICFLOW_VERSION = 'semantic-manifest-v1'

export interface MetricFlowManifest {
  manifest_version: string
  semantic_models: {
    name: string
    description: string
    entities: { name: string; type: 'primary' | 'foreign' }[]
    dimensions: { name: string; type: 'categorical' | 'time'; expr: string }[]
  }[]
  metrics: {
    name: string
    label: string
    description: string
    type: 'simple' | 'derived'
    type_params: { expr: string }
    meta: { grain: string; traces_to: string[]; owner: string }
  }[]
}

export function toMetricFlow(model: SemanticModel, modelName: string): MetricFlowManifest {
  return {
    manifest_version: METRICFLOW_VERSION,
    semantic_models: [
      {
        name: modelName,
        description: `Semantic model for ${modelName}`,
        entities: model.entities.map((entity) => ({
          name: entity.name,
          type: entity.primaryEntity ? ('primary' as const) : ('foreign' as const),
        })),
        dimensions: model.dimensions.map((dimension) => ({
          name: dimension.name,
          type: dimension.type === 'TIME' ? ('time' as const) : ('categorical' as const),
          expr: dimension.expression,
        })),
      },
    ],
    metrics: model.metrics.map((metric) => ({
      name: metric.name,
      label: metric.label,
      description: metric.definition,
      type: 'simple' as const,
      type_params: { expr: metric.expression },
      meta: { grain: metric.grain, traces_to: metric.tracesToQuestions, owner: metric.owner },
    })),
  }
}

export function fromMetricFlow(manifest: MetricFlowManifest): SemanticModel {
  const semanticModel = manifest.semantic_models[0]
  return {
    entities: (semanticModel?.entities ?? []).map((entity) => ({
      name: entity.name,
      primaryEntity: entity.type === 'primary',
      description: '',
    })),
    dimensions: (semanticModel?.dimensions ?? []).map((dimension) => ({
      name: dimension.name,
      type: dimension.type === 'time' ? ('TIME' as const) : ('CATEGORICAL' as const),
      expression: dimension.expr,
    })),
    joins: [],
    metrics: manifest.metrics.map((metric) => ({
      name: metric.name,
      label: metric.label,
      definition: metric.description,
      expression: metric.type_params.expr,
      grain: metric.meta.grain,
      tracesToQuestions: metric.meta.traces_to,
      owner: metric.meta.owner,
    })),
  }
}

/** OpenLineage run event. */
export const OPENLINEAGE_VERSION = '2-0-2'

export interface OpenLineageEvent {
  eventType: 'COMPLETE'
  eventTime: string
  producer: string
  schemaURL: string
  run: { runId: string }
  job: { namespace: string; name: string }
  inputs: { namespace: string; name: string }[]
  outputs: { namespace: string; name: string; facets: { documentation: { description: string } } }[]
}

export function toOpenLineage(params: {
  runId: string
  namespace: string
  jobName: string
  architecture: PhysicalArchitecture
  eventTime: string
  description: string
}): OpenLineageEvent {
  return {
    eventType: 'COMPLETE',
    eventTime: params.eventTime,
    producer: 'https://github.com/adpm/agentic-data-product-management',
    schemaURL: `https://openlineage.io/spec/${OPENLINEAGE_VERSION}/OpenLineage.json`,
    run: { runId: params.runId },
    job: { namespace: params.namespace, name: params.jobName },
    inputs: params.architecture.layers.bronze.map((name) => ({ namespace: params.namespace, name })),
    outputs: params.architecture.layers.gold.map((name) => ({
      namespace: params.namespace,
      name,
      facets: { documentation: { description: params.description } },
    })),
  }
}
