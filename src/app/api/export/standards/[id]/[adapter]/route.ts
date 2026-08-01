import { NextResponse } from 'next/server'
import { stringify as yamlStringify } from 'yaml'
import { prisma } from '@/lib/db'
import { sessionOrNull } from '@/lib/auth/session'
import {
  charterSchema,
  dataContractSchema,
  marketplaceListingSchema,
  physicalArchitectureSchema,
  semanticModelSchema,
} from '@/lib/artifacts/registry'
import {
  STANDARDS_ADAPTERS,
  toCatalogEntity,
  toDcat,
  toMetricFlow,
  toOdcs,
  toOdps,
  toOpenLineage,
  toSchemaOrg,
} from '@/lib/standards'

async function content(productId: string, type: string): Promise<unknown | undefined> {
  const artifact = await prisma.artifact.findUnique({
    where: { productId_type: { productId, type } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  const version = artifact?.versions[0]
  return version ? (JSON.parse(version.contentJson) as unknown) : undefined
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; adapter: string }> },
) {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id, adapter } = await context.params

  const definition = STANDARDS_ADAPTERS.find((entry) => entry.key === adapter)
  if (!definition) {
    return NextResponse.json(
      { error: `Unknown adapter. Available: ${STANDARDS_ADAPTERS.map((a) => a.key).join(', ')}` },
      { status: 404 },
    )
  }

  const product = await prisma.dataProduct.findUnique({
    where: { id },
    include: { workspace: true, domain: true },
  })
  if (!product || product.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: 'Not found in this workspace.' }, { status: 404 })
  }

  const contract = dataContractSchema.safeParse(await content(id, 'data-contract'))
  const listing = marketplaceListingSchema.safeParse(await content(id, 'marketplace-listing'))
  const charter = charterSchema.safeParse(await content(id, 'charter'))
  const semantic = semanticModelSchema.safeParse(await content(id, 'semantic-model'))
  const architecture = physicalArchitectureSchema.safeParse(await content(id, 'physical-architecture'))

  const missing = (what: string) =>
    NextResponse.json(
      { error: `${definition.name} export needs a committed ${what} for this product.` },
      { status: 409 },
    )

  let payload: unknown
  let extension = 'json'

  switch (adapter) {
    case 'odcs': {
      if (!contract.success) return missing('data contract')
      payload = toOdcs({
        id: product.key,
        name: product.name,
        version: product.semanticVersion,
        status: product.status.toLowerCase(),
        purpose: product.description,
        contract: contract.data,
      })
      extension = 'yaml'
      break
    }
    case 'odps': {
      if (!contract.success) return missing('data contract')
      if (!listing.success) return missing('marketplace listing')
      if (!charter.success) return missing('charter')
      payload = toOdps({
        productKey: product.key,
        status: product.status,
        charter: charter.data,
        listing: listing.data,
        contract: contract.data,
      })
      break
    }
    case 'dcat': {
      if (!listing.success) return missing('marketplace listing')
      payload = toDcat({
        productKey: product.key,
        listing: listing.data,
        publisherName: product.workspace.name,
        publishedAt: product.publishedAt,
      })
      break
    }
    case 'openlineage': {
      if (!architecture.success) return missing('physical architecture')
      payload = toOpenLineage({
        runId: product.id,
        namespace: product.workspace.slug,
        jobName: product.key,
        architecture: architecture.data,
        eventTime: new Date().toISOString(),
        description: product.description,
      })
      break
    }
    case 'metricflow': {
      if (!semantic.success) return missing('semantic model')
      payload = toMetricFlow(semantic.data, product.key)
      extension = 'yaml'
      break
    }
    case 'schema-org': {
      if (!listing.success) return missing('marketplace listing')
      payload = toSchemaOrg({
        listing: listing.data,
        metrics: semantic.success
          ? semantic.data.metrics.map((metric) => ({ name: metric.name, definition: metric.definition }))
          : [],
        publisherName: product.workspace.name,
      })
      break
    }
    case 'catalog': {
      if (!listing.success) return missing('marketplace listing')
      payload = toCatalogEntity({ productKey: product.key, listing: listing.data })
      break
    }
    default:
      return NextResponse.json({ error: 'Unsupported adapter.' }, { status: 400 })
  }

  const bodyText =
    extension === 'yaml' ? yamlStringify(payload, { lineWidth: 100 }) : JSON.stringify(payload, null, 2)

  return new NextResponse(bodyText, {
    headers: {
      'content-type': extension === 'yaml' ? 'application/yaml' : 'application/json',
      'content-disposition': `attachment; filename="${product.key}-${adapter}.${extension}"`,
      'x-adapter-version': definition.version,
    },
  })
}
