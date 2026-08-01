import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { prisma } from '@/lib/db'
import { validatePack, type Pack } from './schema'

const PACKS_DIR = 'packs'

export async function listPackFiles(): Promise<string[]> {
  const entries = await readdir(join(process.cwd(), PACKS_DIR))
  return entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort()
}

export async function loadPackFile(fileName: string): Promise<Pack> {
  const raw = await readFile(join(process.cwd(), PACKS_DIR, fileName), 'utf8')
  return validatePack(parseYaml(raw))
}

export async function loadAllPacks(): Promise<{ fileName: string; pack: Pack }[]> {
  const files = await listPackFiles()
  const packs: { fileName: string; pack: Pack }[] = []
  for (const fileName of files) {
    packs.push({ fileName, pack: await loadPackFile(fileName) })
  }
  return packs
}

/** Read an installed pack back out of the database. */
export async function getInstalledPack(key: string): Promise<Pack | undefined> {
  const row = await prisma.pack.findUnique({ where: { key } })
  if (!row) return undefined
  return validatePack(JSON.parse(row.contentJson))
}

export async function getPackForWorkspace(workspaceId: string): Promise<Pack | undefined> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { packKey: true },
  })
  if (!workspace) return undefined
  return getInstalledPack(workspace.packKey)
}
