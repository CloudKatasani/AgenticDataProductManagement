import { z } from 'zod'
import { archetypeSchema, tierSchema } from '@/lib/domain/enums'

/**
 * Pack schema. A pack is declarative industry configuration — no industry name, domain,
 * regulation or entity may appear in application code (invariant 11). Validated on load and by
 * `pnpm pack:validate` in CI.
 *
 * Packs are illustrative and editable, not authoritative. The UI says so on every pack screen.
 */

const key = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Keys are lowercase, digits and hyphens only')

export const packSchema = z.object({
  key,
  name: z.string().min(1),
  industry: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  editable: z.literal(true).default(true),

  domains: z
    .array(z.object({ key, name: z.string().min(1), description: z.string().default('') }))
    .min(6, 'A pack must supply at least six domains'),

  conformedBackbone: z.object({
    description: z.string().default(''),
    entities: z
      .array(z.object({ key, name: z.string().min(1) }))
      .min(4, 'The conformed backbone needs at least four linked entities'),
    links: z.array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        cardinality: z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY']),
      }),
    ),
  }),

  canonicalEntities: z
    .array(z.object({ key, name: z.string().min(1), description: z.string().default('') }))
    .min(10, 'A pack must supply at least ten canonical entities'),

  controls: z
    .array(
      z.object({
        key,
        name: z.string().min(1),
        category: z.string().min(1),
        jurisdiction: z.string().default(''),
        requirement: z.string().min(1),
      }),
    )
    .min(8, 'A pack must supply at least eight regulatory or control constraints'),

  starterMetrics: z
    .array(
      z.object({
        name: z.string().min(1),
        label: z.string().min(1),
        definition: z.string().min(1),
        grain: z.string().min(1),
      }),
    )
    .min(10, 'A pack must supply at least ten starter metrics'),

  sampleDecisions: z
    .array(
      z.object({
        consumerPersona: z.string().min(1),
        decision: z.string().min(1),
        cadence: z.string().min(1),
        currentWorkaround: z.string().default('Manual spreadsheet assembly'),
        latencyTolerance: z.string().default('Daily'),
        consequence: z.string().min(1),
        questions: z.array(z.string().min(1)).min(3),
      }),
    )
    .min(3, 'A pack must supply at least three sample decision records'),

  platformProfiles: z
    .array(
      z.object({
        key,
        name: z.string().min(1),
        bronze: z.string().min(1),
        silver: z.string().min(1),
        gold: z.string().min(1),
        ingestion: z.string().min(1),
        orchestration: z.string().min(1),
      }),
    )
    .min(1),

  glossary: z.array(z.object({ term: z.string().min(1), definition: z.string().min(1) })).default([]),

  seedProducts: z
    .array(
      z.object({
        key,
        name: z.string().min(1),
        domainKey: z.string().min(1),
        archetype: archetypeSchema,
        tier: tierSchema,
        blueprint: z.boolean().default(false),
        description: z.string().min(1),
        persona: z.string().min(1),
        decision: z.string().min(1),
        cadence: z.string().default('Weekly'),
        workaround: z.string().default('A spreadsheet assembled by hand each cycle'),
        consequence: z.string().min(1),
        questions: z.array(z.string().min(1)).min(3),
        sources: z
          .array(z.object({ name: z.string().min(1), system: z.string().min(1) }))
          .min(1),
        entities: z
          .array(
            z.object({
              name: z.string().min(1),
              key: z.string().min(1),
              /** A trailing `*` marks the attribute as personal data. */
              attributes: z.array(z.string().min(1)).min(2),
            }),
          )
          .min(1),
        metrics: z
          .array(
            z.object({
              name: z.string().min(1),
              label: z.string().min(1),
              definition: z.string().min(1),
              grain: z.string().min(1),
              expression: z.string().default(''),
            }),
          )
          .min(1),
        controls: z.array(z.string()).min(1),
        patterns: z.array(z.string()).min(1),
        freshness: z.string().min(1),
        qualityScore: z.number().min(0).max(100),
        costToServeUsdPerMonth: z.number().min(0),
        platformProfileKey: z.string().min(1),
        value: z.object({
          statement: z.string().min(1),
          baseline: z.number(),
          unit: z.string().min(1),
          expectedChange: z.number(),
          method: z.string().min(1),
          date: z.string().min(1),
          realised: z.boolean().default(false),
          measured: z.number().optional(),
        }),
        telemetry: z
          .object({
            consumers: z.number().min(0).default(0),
            queries30d: z.number().min(0).default(0),
            sessions30d: z.number().min(0).default(0),
            daysSinceLastUse: z.number().min(0).default(1),
            freshnessBreaches30d: z.number().min(0).default(0),
          })
          .default({
            consumers: 0,
            queries30d: 0,
            sessions30d: 0,
            daysSinceLastUse: 1,
            freshnessBreaches30d: 0,
          }),
      }),
    )
    .min(3, 'A pack must supply at least three seed products'),
})

export type Pack = z.infer<typeof packSchema>
export type PackSeedProduct = Pack['seedProducts'][number]
export type PackControl = Pack['controls'][number]
export type PackDomain = Pack['domains'][number]

export function validatePack(raw: unknown): Pack {
  const parsed = packSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Pack validation failed:\n${issues}`)
  }
  const pack = parsed.data
  const domainKeys = new Set(pack.domains.map((d) => d.key))
  const controlKeys = new Set(pack.controls.map((c) => c.key))
  const profileKeys = new Set(pack.platformProfiles.map((p) => p.key))

  for (const product of pack.seedProducts) {
    if (!domainKeys.has(product.domainKey)) {
      throw new Error(`Seed product ${product.key} references unknown domain ${product.domainKey}`)
    }
    if (!profileKeys.has(product.platformProfileKey)) {
      throw new Error(
        `Seed product ${product.key} references unknown platform profile ${product.platformProfileKey}`,
      )
    }
    for (const control of product.controls) {
      if (!controlKeys.has(control)) {
        throw new Error(`Seed product ${product.key} references unknown control ${control}`)
      }
    }
  }
  return pack
}
