/**
 * Minimal JSON path helpers for field-level agent proposals and provenance.
 * Supported syntax: `a.b`, `a[0].b` — enough for artifact content, nothing more.
 */

export function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = []
  for (const segment of path.split('.')) {
    const match = /^([^[\]]*)((\[\d+\])*)$/.exec(segment)
    if (!match) throw new Error(`Unsupported field path: ${path}`)
    if (match[1]) parts.push(match[1])
    for (const index of match[2]?.match(/\d+/g) ?? []) parts.push(Number(index))
  }
  return parts
}

export function getAtPath(target: unknown, path: string): unknown {
  let current: unknown = target
  for (const key of parsePath(path)) {
    if (current === null || current === undefined) return undefined
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[key]
    } else {
      if (typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[key]
    }
  }
  return current
}

/** Returns a new object with `value` written at `path`; never mutates the input. */
export function setAtPath<T>(target: T, path: string, value: unknown): T {
  const keys = parsePath(path)
  if (keys.length === 0) return value as T

  const clone = (node: unknown, depth: number): unknown => {
    const key = keys[depth]
    if (key === undefined) return value
    if (typeof key === 'number') {
      const array = Array.isArray(node) ? [...node] : []
      array[key] = clone(array[key], depth + 1)
      return array
    }
    const object =
      node && typeof node === 'object' && !Array.isArray(node)
        ? { ...(node as Record<string, unknown>) }
        : {}
    object[key] = clone(object[key], depth + 1)
    return object
  }

  return clone(target, 0) as T
}
