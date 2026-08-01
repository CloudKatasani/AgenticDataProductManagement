import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Integration tests run against their own SQLite file so they never touch the demo database.
 */
export default function globalSetup() {
  const dbPath = join(process.cwd(), 'prisma', 'test.db')
  rmSync(dbPath, { force: true })
  execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  })
}
