import { createHash } from 'node:crypto'

/**
 * Canonical JSON: object keys sorted recursively so that two structurally identical payloads
 * always hash identically regardless of authoring order.
 */
export function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([k, v]) => [k, canonicalise(v)]))
  }
  return value
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex')
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12)
}
