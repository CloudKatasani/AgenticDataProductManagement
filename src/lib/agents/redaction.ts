import { attributeRegisterSchema } from '@/lib/artifacts/registry'

/**
 * Nothing leaves the machine except explicit agent calls, and those calls carry no value that
 * an attribute register has flagged as PII or restricted. The redacted payload is shown to the
 * user before the first call of a session — see the agent panel.
 */

export interface RedactionResult {
  payload: Record<string, unknown>
  redactedFields: string[]
}

const ALWAYS_REDACT = /(email|phone|ssn|nino|dob|birth|address|passport|iban|account_?number)/i

export function redactForAgent(
  scopedArtifacts: Record<string, unknown>,
  options: { allowSampleData: boolean },
): RedactionResult {
  const register = scopedArtifacts['attribute-register']
  const parsed = register ? attributeRegisterSchema.safeParse(register) : undefined
  const sensitiveNames = new Set<string>()
  if (parsed?.success) {
    for (const attribute of parsed.data.attributes) {
      if (attribute.pii || attribute.sensitivity === 'RESTRICTED') {
        sensitiveNames.add(attribute.name.toLowerCase())
      }
    }
  }

  const redactedFields: string[] = []

  const walk = (node: unknown, path: string): unknown => {
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${path}[${i}]`))
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key
        const looksSensitive = sensitiveNames.has(key.toLowerCase()) || ALWAYS_REDACT.test(key)
        const isSampleValue = /^(sample|example|value|rows?)$/i.test(key)
        if (looksSensitive && typeof value !== 'object') {
          redactedFields.push(childPath)
          out[key] = '«redacted»'
        } else if (isSampleValue && !options.allowSampleData) {
          redactedFields.push(childPath)
          out[key] = '«sample data withheld»'
        } else {
          out[key] = walk(value, childPath)
        }
      }
      return out
    }
    return node
  }

  return {
    payload: walk(scopedArtifacts, '') as Record<string, unknown>,
    redactedFields,
  }
}
