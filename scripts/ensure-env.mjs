/**
 * Runs on `pnpm install`. Creates .env from .env.example when it is missing, so a fresh clone
 * really does run on `pnpm install && pnpm db:seed && pnpm dev` with nothing else to configure.
 *
 * .env stays git-ignored. The value it seeds for AUTH_SECRET is a development placeholder and the
 * file says so; anything reachable by more than one laptop must replace it.
 *
 * Plain .mjs, not .ts, because postinstall can run in a production install where tsx is absent.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const env = resolve(process.cwd(), '.env')
const example = resolve(process.cwd(), '.env.example')

if (existsSync(env)) {
  process.exit(0)
}
if (!existsSync(example)) {
  // Nothing to copy from. Not fatal — the app will report the missing variable itself.
  process.exit(0)
}

copyFileSync(example, env)
process.stdout.write(
  'Created .env from .env.example.\n' +
    '  AUTH_SECRET is a local development placeholder. Replace it before this instance is\n' +
    '  reachable by anyone but you: openssl rand -base64 32\n',
)
