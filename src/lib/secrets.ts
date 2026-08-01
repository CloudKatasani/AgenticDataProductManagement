import { readFile, writeFile, chmod } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Secrets live in the environment or in a local, git-ignored file with owner-only permissions.
 * Never in the database, never in a committed artifact — see CLAUDE.md §16.
 */

const SECRETS_FILE = '.adpm-secrets.json'

interface SecretStore {
  anthropicApiKey?: string
  model?: string
}

async function readStore(): Promise<SecretStore> {
  try {
    const raw = await readFile(join(process.cwd(), SECRETS_FILE), 'utf8')
    return JSON.parse(raw) as SecretStore
  } catch {
    return {}
  }
}

export async function getAgentCredentials(): Promise<{ apiKey?: string; model?: string }> {
  const store = await readStore()
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? store.anthropicApiKey,
    model: process.env.ADPM_AGENT_MODEL ?? store.model,
  }
}

export async function setAgentCredentials(input: {
  apiKey?: string
  model?: string
}): Promise<void> {
  const store = await readStore()
  const next: SecretStore = {
    anthropicApiKey: input.apiKey?.trim() ? input.apiKey.trim() : store.anthropicApiKey,
    model: input.model?.trim() ? input.model.trim() : store.model,
  }
  if (input.apiKey === '') delete next.anthropicApiKey
  const path = join(process.cwd(), SECRETS_FILE)
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await chmod(path, 0o600)
}

/** Never returns the key itself. */
export async function credentialStatus(): Promise<{ configured: boolean; model?: string; hint?: string }> {
  const { apiKey, model } = await getAgentCredentials()
  return {
    configured: !!apiKey,
    model,
    hint: apiKey ? `••••${apiKey.slice(-4)}` : undefined,
  }
}
