import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalise, contentHash } from '@/lib/hash'
import { diffContent, summariseDiff } from '@/lib/artifacts/diff'
import { getAtPath, setAtPath } from '@/lib/util/path'
import { ARTIFACT_TYPES, getArtifactType } from '@/lib/artifacts/registry'
import { STAGES, raciMatrix } from '@/lib/lifecycle/stages'
import { CONSUMPTION_PATTERNS, evaluatePatternReadiness } from '@/lib/patterns/registry'
import { deriveInputs, wsjfWithReuse } from '@/lib/portfolio/scoring'
import { ROLES } from '@/lib/domain/roles'
import { STAGE_GUIDES } from '@/lib/guides/registry'

describe('content hashing', () => {
  it('is stable regardless of key order', () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }))
  })

  it('changes when content changes', () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })

  it('drops undefined values when canonicalising', () => {
    expect(canonicalise({ a: 1, b: undefined })).toEqual({ a: 1 })
  })
})

describe('field paths', () => {
  it('reads and writes nested array paths without mutating the original', () => {
    const original = { decisions: [{ questions: ['a'] }] }
    const updated = setAtPath(original, 'decisions[0].questions', ['a', 'b'])
    expect(getAtPath(updated, 'decisions[0].questions')).toEqual(['a', 'b'])
    expect(getAtPath(original, 'decisions[0].questions')).toEqual(['a'])
  })

  it('creates intermediate structures when writing a new path', () => {
    const updated = setAtPath({}, 'gaps[0].id', 'GAP-1')
    expect(getAtPath(updated, 'gaps[0].id')).toBe('GAP-1')
  })
})

describe('artifact diff', () => {
  it('reports added, changed and removed fields', () => {
    const changes = diffContent({ a: 1, b: 2 }, { a: 9, c: 3 })
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'a', change: 'CHANGED' }),
        expect.objectContaining({ path: 'b', change: 'REMOVED' }),
        expect.objectContaining({ path: 'c', change: 'ADDED' }),
      ]),
    )
    expect(summariseDiff(changes)).toContain('added')
  })
})

describe('registries are internally consistent', () => {
  it('gives every stage a definition, artifacts and approvers', () => {
    expect(STAGES).toHaveLength(12)
    for (const stage of STAGES) {
      expect(stage.requiredArtifacts.length).toBeGreaterThan(0)
      expect(stage.approverRoles.length).toBeGreaterThan(0)
      expect(stage.quorum).toBeLessThanOrEqual(stage.approverRoles.length)
      for (const type of stage.requiredArtifacts) {
        expect(() => getArtifactType(type)).not.toThrow()
        expect(getArtifactType(type).stage).toBe(stage.number)
      }
      for (const role of [...stage.approverRoles, ...stage.vetoRoles]) {
        expect(ROLES.map((entry) => entry.key)).toContain(role)
      }
    }
  })

  it('maps every artifact type to a stage that exists', () => {
    for (const artifact of ARTIFACT_TYPES) {
      expect(STAGES.some((stage) => stage.number === artifact.stage)).toBe(true)
    }
  })

  it('computes the RACI matrix from the same registry the engine enforces', () => {
    const matrix = raciMatrix()
    const privacy = matrix.find((row) => row.role === 'PRIVACY_SECURITY_OFFICER')
    expect(privacy?.vetoes).toEqual([9])
    const council = matrix.find((row) => row.role === 'GOVERNANCE_COUNCIL')
    expect(council?.vetoes).toEqual(expect.arrayContaining([11, 12]))
  })

  it('has a guide for every stage', () => {
    expect(STAGE_GUIDES).toHaveLength(12)
    for (const stage of STAGES) {
      expect(STAGE_GUIDES.some((guide) => guide.stageNumber === stage.number)).toBe(true)
    }
  })
})

describe('consumption pattern readiness', () => {
  it('is red when a required artifact is absent', () => {
    const pattern = CONSUMPTION_PATTERNS.find((entry) => entry.key === 'conversational')!
    const result = evaluatePatternReadiness(pattern, new Set(), [], () => 10)
    expect(result.readiness).toBe('ABSENT')
  })

  it('is amber when artifacts exist but the stage is not approved', () => {
    const pattern = CONSUMPTION_PATTERNS.find((entry) => entry.key === 'conversational')!
    const result = evaluatePatternReadiness(
      pattern,
      new Set(pattern.requiredArtifacts),
      [],
      (type) => getArtifactType(type).stage,
    )
    expect(result.readiness).toBe('DRAFTED')
    expect(result.blockedReason).toContain('Stage 10')
  })

  it('is green only when every requirement is approved', () => {
    const pattern = CONSUMPTION_PATTERNS.find((entry) => entry.key === 'conversational')!
    const result = evaluatePatternReadiness(
      pattern,
      new Set(pattern.requiredArtifacts),
      [6, 10],
      (type) => getArtifactType(type).stage,
    )
    expect(result.readiness).toBe('READY')
  })
})

describe('prioritisation scoring', () => {
  it('rewards reuse and penalises effort', () => {
    const base = { value: 8, urgency: 8, riskReduction: 6, effort: 4, reuse: 0 }
    const withReuse = wsjfWithReuse({ ...base, reuse: 0.5 })
    const withoutReuse = wsjfWithReuse(base)
    expect(withReuse.score).toBeGreaterThan(withoutReuse.score)

    const higherEffort = wsjfWithReuse({ ...base, effort: 8 })
    expect(higherEffort.score).toBeLessThan(withoutReuse.score)
  })

  it('never divides by zero effort', () => {
    expect(Number.isFinite(wsjfWithReuse({ value: 5, urgency: 5, riskReduction: 5, effort: 0, reuse: 0 }).score)).toBe(
      true,
    )
  })

  it('derives inputs from committed facts rather than opinion', () => {
    const inputs = deriveInputs({
      peopleAffected: 100,
      cadence: 'Daily',
      sensitiveAttributes: 3,
      buildEffortDays: 40,
      backboneBindings: 2,
      reusedMetrics: 1,
      totalMetrics: 4,
    })
    expect(inputs.urgency).toBe(9)
    expect(inputs.reuse).toBeGreaterThan(0)
    expect(inputs.effort).toBe(4)
  })
})

/**
 * The brand palette is a contract, not decoration: the top layer inverts to a dark bar, so every
 * colour pair it introduces has to clear WCAG AA before it ships. These read the real tokens out of
 * globals.css, so re-skinning the product cannot quietly drop contrast below the line.
 */
function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter! + 0.05) / (darker! + 0.05)
}

function brandTokens(): Record<string, string> {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  const tokens: Record<string, string> = {}
  for (const [, name, value] of css.matchAll(/--color-((?:brand|accent)-\d+):\s*(#[0-9a-f]{6});/g)) {
    tokens[name!] = value!
  }
  return tokens
}

describe('brand palette', () => {
  const tokens = brandTokens()

  it('keeps the two anchor hexes the rest of the scale is derived from', () => {
    expect(tokens['brand-600']).toBe('#0070ad')
    expect(tokens['brand-400']).toBe('#12abdb')
  })

  it('drives the accent scale from the brand scale, so chrome and pages agree', () => {
    expect(tokens['accent-600']).toBe(tokens['brand-600'])
    expect(tokens['accent-700']).toBe(tokens['brand-700'])
  })

  it('clears AA for every text pair the dark top layer introduces', () => {
    const bar = tokens['brand-900']!
    expect(contrast('#ffffff', bar)).toBeGreaterThanOrEqual(4.5) // wordmark and user name
    expect(contrast(tokens['brand-200']!, bar)).toBeGreaterThanOrEqual(4.5) // inactive nav item
    expect(contrast(tokens['brand-300']!, bar)).toBeGreaterThanOrEqual(4.5) // nav group label
    expect(contrast(tokens['brand-900']!, tokens['brand-400']!)).toBeGreaterThanOrEqual(4.5) // active item
    expect(contrast('#ffffff', tokens['brand-800']!)).toBeGreaterThanOrEqual(4.5) // workspace select
  })

  it('clears AA for brand text on the light pages', () => {
    expect(contrast('#ffffff', tokens['accent-600']!)).toBeGreaterThanOrEqual(4.5) // primary button
    expect(contrast(tokens['accent-700']!, '#ffffff')).toBeGreaterThanOrEqual(4.5) // links
    expect(contrast(tokens['accent-700']!, tokens['accent-50']!)).toBeGreaterThanOrEqual(4.5) // info badge
  })

  it('distinguishes the active nav item from the bar as a component, and the focus ring with it', () => {
    expect(contrast(tokens['brand-400']!, tokens['brand-900']!)).toBeGreaterThanOrEqual(3)
  })
})
