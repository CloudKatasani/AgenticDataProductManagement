/**
 * Derive prisma/schema.postgres.prisma from the canonical SQLite schema.
 *
 * There is exactly one schema in this repository. The Postgres variant is generated, never
 * hand-maintained, so the two cannot drift: a model added for SQLite is a model Postgres gets.
 * The only difference the two stores need is the datasource provider — every column type in
 * prisma/schema.prisma (String, Int, Float, Boolean, DateTime) is portable as written, and the
 * JSON payloads are String columns by design so neither store has to be special-cased.
 *
 * Run it through `pnpm db:pg:prepare`; `pnpm db:pg:setup` also pushes and regenerates the client.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = resolve(process.cwd(), 'prisma/schema.prisma')
const TARGET = resolve(process.cwd(), 'prisma/schema.postgres.prisma')

const BANNER = `// GENERATED FILE — do not edit.
//
// Produced by scripts/prepare-postgres.ts from prisma/schema.prisma. Edit the SQLite schema and
// re-run \`pnpm db:pg:prepare\`; any edit made here is lost on the next run.
`

const DATASOURCE = /datasource\s+db\s*\{[^}]*\}/

function main(): void {
  const source = readFileSync(SOURCE, 'utf8')
  const datasource = source.match(DATASOURCE)

  if (!datasource) {
    throw new Error(`No datasource block found in ${SOURCE}. Cannot derive the Postgres schema.`)
  }
  if (!datasource[0].includes('provider = "sqlite"')) {
    throw new Error(
      `${SOURCE} is no longer a SQLite datasource. This script exists to translate SQLite → Postgres; ` +
        'check what changed before regenerating.',
    )
  }

  const output =
    BANNER +
    source.replace(
      DATASOURCE,
      ['datasource db {', '  provider = "postgresql"', '  url      = env("DATABASE_URL")', '}'].join('\n'),
    )

  writeFileSync(TARGET, output, 'utf8')
  process.stdout.write(`Wrote ${TARGET}\n`)
}

main()
