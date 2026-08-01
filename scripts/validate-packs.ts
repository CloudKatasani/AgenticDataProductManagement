import { loadAllPacks } from '@/lib/packs/loader'
import { CONSUMPTION_PATTERNS } from '@/lib/patterns/registry'

/**
 * `pnpm pack:validate` — run in CI. Fails loudly rather than letting a broken pack reach a seed.
 */
async function main() {
  const patternKeys = new Set(CONSUMPTION_PATTERNS.map((p) => p.key))
  let failures = 0

  const packs = await loadAllPacks()
  for (const { fileName, pack } of packs) {
    const problems: string[] = []
    for (const product of pack.seedProducts) {
      for (const patternKey of product.patterns) {
        if (!patternKeys.has(patternKey)) {
          problems.push(`${product.key} targets unknown consumption pattern "${patternKey}"`)
        }
      }
    }
    if (problems.length) {
      failures += problems.length
      console.error(`✗ ${fileName}`)
      for (const problem of problems) console.error(`    ${problem}`)
    } else {
      console.log(
        `✓ ${fileName} — ${pack.domains.length} domains, ${pack.canonicalEntities.length} entities, ` +
          `${pack.controls.length} controls, ${pack.starterMetrics.length} metrics, ` +
          `${pack.seedProducts.length} seed products`,
      )
    }
  }

  if (packs.length === 0) {
    console.error('No packs found in packs/.')
    process.exit(1)
  }
  if (failures > 0) {
    console.error(`\n${failures} problem(s) found.`)
    process.exit(1)
  }
  console.log(`\n${packs.length} pack(s) valid.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
