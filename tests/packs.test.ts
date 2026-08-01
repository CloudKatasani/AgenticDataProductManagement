import { describe, expect, it } from 'vitest'
import { loadAllPacks } from '@/lib/packs/loader'
import { CONSUMPTION_PATTERNS } from '@/lib/patterns/registry'

/**
 * The marketplace is the first screen a stakeholder sees, and an empty industry/domain
 * combination reads as "this product does not cover my area". These tests hold the shape of the
 * seeded catalogue so that adding a domain to a pack without adding a product to it fails here
 * rather than in front of a client.
 */

const packs = await loadAllPacks()

describe('pack catalogue coverage', () => {
  it('ships a sample data product for every industry and domain combination', () => {
    const gaps: string[] = []
    for (const { pack } of packs) {
      const covered = new Set(pack.seedProducts.map((p) => p.domainKey))
      for (const domain of pack.domains) {
        if (!covered.has(domain.key)) gaps.push(`${pack.key}/${domain.key}`)
      }
    }
    expect(gaps, `Domains with no seed product: ${gaps.join(', ')}`).toEqual([])
  })

  it('keeps metric names unique within a pack, because Stage 6 blocks collisions', () => {
    // This is not a style rule. `metric-names-unique` is a Stage 6 exit criterion evaluated
    // across the workspace, so a duplicate here stops the seed dead partway through.
    for (const { pack } of packs) {
      const seen = new Map<string, string>()
      const collisions: string[] = []
      for (const product of pack.seedProducts) {
        for (const metric of product.metrics) {
          const name = metric.name.toLowerCase()
          const owner = seen.get(name)
          if (owner) collisions.push(`${name} (${owner} and ${product.key})`)
          else seen.set(name, product.key)
        }
      }
      expect(collisions, `${pack.key} metric collisions`).toEqual([])
    }
  })

  it('gives every seed product a named consumer, a blocked decision and real questions', () => {
    // Invariant 1, applied to the demo data: a product with no consumer would sail through the
    // schema and then fail Stage 1, and a marketplace of such products would teach the wrong thing.
    for (const { pack } of packs) {
      for (const product of pack.seedProducts) {
        expect(product.persona.trim().length, `${pack.key}/${product.key} persona`).toBeGreaterThan(3)
        expect(product.decision.trim().length, `${pack.key}/${product.key} decision`).toBeGreaterThan(10)
        expect(product.questions.length, `${pack.key}/${product.key} questions`).toBeGreaterThanOrEqual(3)
        expect(product.value.statement.trim().length).toBeGreaterThan(10)
      }
    }
  })

  it('references only patterns, domains, controls and profiles the pack actually declares', () => {
    const patternKeys = new Set(CONSUMPTION_PATTERNS.map((p) => p.key))
    for (const { pack } of packs) {
      const domains = new Set(pack.domains.map((d) => d.key))
      const controls = new Set(pack.controls.map((c) => c.key))
      const profiles = new Set(pack.platformProfiles.map((p) => p.key))
      for (const product of pack.seedProducts) {
        expect(domains.has(product.domainKey), `${product.key} domain`).toBe(true)
        expect(profiles.has(product.platformProfileKey), `${product.key} profile`).toBe(true)
        for (const control of product.controls) {
          expect(controls.has(control), `${product.key} control ${control}`).toBe(true)
        }
        for (const pattern of product.patterns) {
          expect(patternKeys.has(pattern), `${product.key} pattern ${pattern}`).toBe(true)
        }
      }
    }
  })

  it('gives the utility Customer & Account domain more than one sample', () => {
    // Deliberate: a domain is a place to look, not a single product. The reference pack shows it.
    const utility = packs.find((p) => p.pack.key === 'utility-energy')?.pack
    expect(utility).toBeDefined()
    const customerProducts = utility!.seedProducts.filter((p) => p.domainKey === 'customer-account')
    expect(customerProducts.length).toBeGreaterThanOrEqual(3)
  })
})
