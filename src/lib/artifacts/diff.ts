import { canonicalise } from '@/lib/hash'

export interface FieldChange {
  path: string
  change: 'ADDED' | 'REMOVED' | 'CHANGED'
  before?: string
  after?: string
}

function render(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function flatten(value: unknown, prefix = '', out: Map<string, unknown> = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
    if (value.length === 0) out.set(prefix, [])
    return out
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) out.set(prefix, {})
    for (const [key, child] of entries) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }
  out.set(prefix, value)
  return out
}

/** Field-level diff between two artifact contents, used by the version-diff panel. */
export function diffContent(before: unknown, after: unknown): FieldChange[] {
  const a = flatten(canonicalise(before))
  const b = flatten(canonicalise(after))
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort()
  const changes: FieldChange[] = []

  for (const path of paths) {
    const hasBefore = a.has(path)
    const hasAfter = b.has(path)
    const beforeValue = a.get(path)
    const afterValue = b.get(path)
    if (hasBefore && !hasAfter) {
      changes.push({ path, change: 'REMOVED', before: render(beforeValue) })
    } else if (!hasBefore && hasAfter) {
      changes.push({ path, change: 'ADDED', after: render(afterValue) })
    } else if (render(beforeValue) !== render(afterValue)) {
      changes.push({
        path,
        change: 'CHANGED',
        before: render(beforeValue),
        after: render(afterValue),
      })
    }
  }
  return changes
}

export function summariseDiff(changes: FieldChange[]): string {
  if (changes.length === 0) return 'No content change.'
  const added = changes.filter((c) => c.change === 'ADDED').length
  const removed = changes.filter((c) => c.change === 'REMOVED').length
  const changed = changes.filter((c) => c.change === 'CHANGED').length
  return `${added} added, ${changed} changed, ${removed} removed`
}
