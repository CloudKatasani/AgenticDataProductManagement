import { prisma } from '@/lib/db'
import { ROLES, type RoleKey } from '@/lib/domain/roles'
import { STAGES } from '@/lib/lifecycle/stages'
import { AGENTS } from '@/lib/agents/registry'
import { loadPackFile } from '@/lib/packs/loader'
import { buildBlueprintArtifacts } from '@/lib/packs/blueprint'
import { commitArtifact } from '@/lib/artifacts/commit'
import { ensureStageRun } from '@/lib/lifecycle/transitions'
import type { Pack, PackSeedProduct } from '@/lib/packs/schema'

let packCache: Pack | undefined

export async function utilityPack(): Promise<Pack> {
  packCache ??= await loadPackFile('utility-energy.yaml')
  return packCache
}

export interface Fixture {
  workspaceId: string
  domainId: string
  users: Map<RoleKey, string>
  pack: Pack
  spec: PackSeedProduct
}

let counter = 0

/** A clean workspace with one user per role, seeded from the reference pack. */
export async function createFixture(options: { agentsEnabled?: boolean } = {}): Promise<Fixture> {
  const pack = await utilityPack()
  counter += 1
  const suffix = `${Date.now().toString(36)}-${counter}`

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { id: role.key },
      update: {},
      create: {
        id: role.key,
        key: role.key,
        name: role.name,
        door: role.door,
        owns: role.owns,
        description: role.description,
        sortOrder: role.sortOrder,
      },
    })
  }
  for (const stage of STAGES) {
    await prisma.stage.upsert({
      where: { number: stage.number },
      update: {},
      create: { number: stage.number, key: stage.key, name: stage.name, purpose: stage.purpose },
    })
  }
  await prisma.pack.upsert({
    where: { key: pack.key },
    update: { contentJson: JSON.stringify(pack) },
    create: {
      key: pack.key,
      name: pack.name,
      industry: pack.industry,
      version: pack.version,
      sourcePath: 'packs/utility-energy.yaml',
      contentJson: JSON.stringify(pack),
    },
  })

  const workspace = await prisma.workspace.create({
    data: {
      slug: `test-${suffix}`,
      name: `Test workspace ${suffix}`,
      packKey: pack.key,
      agentsEnabled: options.agentsEnabled ?? false,
    },
  })

  const domain = await prisma.domain.create({
    data: {
      workspaceId: workspace.id,
      key: pack.domains[0]!.key,
      name: pack.domains[0]!.name,
    },
  })

  const users = new Map<RoleKey, string>()
  for (const role of ROLES) {
    const user = await prisma.user.create({
      data: {
        email: `${role.key.toLowerCase()}-${suffix}@test.local`,
        name: role.seedName,
        passwordHash: 'not-used-in-tests',
      },
    })
    users.set(role.key, user.id)
    await prisma.roleAssignment.create({
      data: { userId: user.id, roleId: role.key, workspaceId: workspace.id },
    })
  }

  for (const agent of AGENTS) {
    await prisma.agentSetting.create({
      data: {
        workspaceId: workspace.id,
        agentId: agent.id,
        autonomyLevel: agent.autonomyCeiling === 'L3' ? 'L3' : 'L1',
        enabled: true,
      },
    })
  }

  return { workspaceId: workspace.id, domainId: domain.id, users, pack, spec: pack.seedProducts[0]! }
}

export async function createProduct(fixture: Fixture, key = `p-${Date.now().toString(36)}`) {
  const product = await prisma.dataProduct.create({
    data: {
      workspaceId: fixture.workspaceId,
      domainId: fixture.domainId,
      key,
      name: `Product ${key}`,
      description: 'Test product',
      ownerId: fixture.users.get('DOMAIN_PRODUCT_OWNER')!,
      stewardId: fixture.users.get('DATA_STEWARD')!,
    },
  })
  await ensureStageRun(product.id, 1)
  return product
}

export function blueprintArtifacts(fixture: Fixture) {
  return buildBlueprintArtifacts(fixture.pack, fixture.spec, {
    now: new Date('2026-08-01T00:00:00.000Z'),
    ownerName: 'Marcus Bell',
    stewardName: 'Priya Raman',
    domainName: 'Credit & Collections',
  })
}

export async function commit(
  fixture: Fixture,
  productId: string,
  artifactType: string,
  content: unknown,
) {
  return commitArtifact({
    productId,
    artifactType,
    content,
    userId: fixture.users.get('DATA_STEWARD')!,
    message: 'test commit',
  })
}
