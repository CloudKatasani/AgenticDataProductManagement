import { prisma } from '@/lib/db'
import {
  certificationScorecardSchema,
  dataContractSchema,
  decisionRegisterSchema,
  marketplaceListingSchema,
  semanticModelSchema,
  telemetrySchema,
  type MarketplaceListing,
} from '@/lib/artifacts/registry'

/**
 * The marketplace is assembled entirely from committed artifacts. Nothing here reads a
 * hand-maintained catalogue field — if it is on the listing, a human approved the artifact it
 * came from.
 */

export interface MarketplaceEntry {
  productId: string
  key: string
  name: string
  status: string
  industry: string
  workspaceName: string
  workspaceSlug: string
  domainName: string
  archetype: string
  tier: string
  publishedAt: Date | null
  listing: MarketplaceListing
  entities: string[]
  metrics: string[]
}

async function latestContent(productId: string, type: string): Promise<unknown | undefined> {
  const artifact = await prisma.artifact.findUnique({
    where: { productId_type: { productId, type } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  const version = artifact?.versions[0]
  return version ? (JSON.parse(version.contentJson) as unknown) : undefined
}

export async function listMarketplace(): Promise<MarketplaceEntry[]> {
  const products = await prisma.dataProduct.findMany({
    where: { status: { in: ['PUBLISHED', 'DEPRECATED'] }, archivedAt: null },
    include: {
      domain: true,
      workspace: true,
      artifacts: {
        where: { type: { in: ['marketplace-listing', 'semantic-model'] } },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const packs = await prisma.pack.findMany({ select: { key: true, industry: true } })
  const industryByPack = new Map(packs.map((p) => [p.key, p.industry]))

  const entries: MarketplaceEntry[] = []
  for (const product of products) {
    const listingArtifact = product.artifacts.find((a) => a.type === 'marketplace-listing')
    const listingVersion = listingArtifact?.versions[0]
    if (!listingVersion) continue
    const parsed = marketplaceListingSchema.safeParse(JSON.parse(listingVersion.contentJson))
    if (!parsed.success) continue

    const semanticVersion = product.artifacts.find((a) => a.type === 'semantic-model')?.versions[0]
    const semantic = semanticVersion
      ? semanticModelSchema.safeParse(JSON.parse(semanticVersion.contentJson))
      : undefined

    entries.push({
      productId: product.id,
      key: product.key,
      name: product.name,
      status: product.status,
      industry: industryByPack.get(product.workspace.packKey) ?? product.workspace.packKey,
      workspaceName: product.workspace.name,
      workspaceSlug: product.workspace.slug,
      domainName: product.domain.name,
      archetype: product.archetype,
      tier: product.tier,
      publishedAt: product.publishedAt,
      listing: parsed.data,
      entities: parsed.data.entities,
      metrics: semantic?.success ? semantic.data.metrics.map((m) => m.name) : [],
    })
  }
  return entries
}

export interface MarketplaceDetail {
  entry: MarketplaceEntry
  questions: string[]
  metrics: { name: string; label: string; definition: string; grain: string }[]
  contract?: { freshnessMinutes: number; availabilityPct: number; maxNullRatePct: number }
  scorecard?: { dimension: string; score: number; citations: number }[]
  telemetry?: { consumers: number; queries30d: number; lastUsedAt: string }
  approvals: { stageNumber: number; decidedAt: Date | null; state: string }[]
  similar: { productId: string; name: string; shared: string[] }[]
}

export async function marketplaceDetail(productKey: string): Promise<MarketplaceDetail | undefined> {
  const all = await listMarketplace()
  const entry = all.find((e) => e.key === productKey)
  if (!entry) return undefined

  const register = await latestContent(entry.productId, 'decision-register')
  const parsedRegister = register ? decisionRegisterSchema.safeParse(register) : undefined
  const semantic = await latestContent(entry.productId, 'semantic-model')
  const parsedSemantic = semantic ? semanticModelSchema.safeParse(semantic) : undefined
  const contract = await latestContent(entry.productId, 'data-contract')
  const parsedContract = contract ? dataContractSchema.safeParse(contract) : undefined
  const scorecard = await latestContent(entry.productId, 'certification-scorecard')
  const parsedScorecard = scorecard ? certificationScorecardSchema.safeParse(scorecard) : undefined
  const telemetry = await latestContent(entry.productId, 'telemetry')
  const parsedTelemetry = telemetry ? telemetrySchema.safeParse(telemetry) : undefined

  const gates = await prisma.gate.findMany({
    where: { productId: entry.productId },
    orderBy: { stageNumber: 'asc' },
    select: { stageNumber: true, decidedAt: true, state: true },
  })

  const similar = all
    .filter((other) => other.productId !== entry.productId)
    .map((other) => ({
      productId: other.productId,
      name: other.name,
      shared: other.entities.filter((e) =>
        entry.entities.some((mine) => mine.toLowerCase() === e.toLowerCase()),
      ),
    }))
    .filter((other) => other.shared.length > 0)
    .slice(0, 5)

  return {
    entry,
    questions: parsedRegister?.success
      ? parsedRegister.data.decisions.flatMap((d) => d.questions)
      : [],
    metrics: parsedSemantic?.success
      ? parsedSemantic.data.metrics.map((m) => ({
          name: m.name,
          label: m.label,
          definition: m.definition,
          grain: m.grain,
        }))
      : [],
    contract: parsedContract?.success ? parsedContract.data.slas : undefined,
    scorecard: parsedScorecard?.success
      ? parsedScorecard.data.dimensions.map((d) => ({
          dimension: d.dimension,
          score: d.score,
          citations: d.citations.length,
        }))
      : undefined,
    telemetry: parsedTelemetry?.success
      ? {
          consumers: parsedTelemetry.data.consumers,
          queries30d: parsedTelemetry.data.queries30d,
          lastUsedAt: parsedTelemetry.data.lastUsedAt,
        }
      : undefined,
    approvals: gates,
    similar,
  }
}
