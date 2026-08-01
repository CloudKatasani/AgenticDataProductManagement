import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { signOut } from '@/auth'
import { MainNav } from '@/components/nav'
import { TourOverlay } from '@/components/tour'
import { GUIDED_TOURS } from '@/lib/guides/registry'
import { requireSession, listWorkspacesForUser, WORKSPACE_COOKIE_NAME } from '@/lib/auth/session'
import { roleName } from '@/lib/domain/roles'
import { Badge } from '@/components/ui'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const workspaces = await listWorkspacesForUser(session.userId)

  async function switchWorkspace(formData: FormData) {
    'use server'
    const slug = String(formData.get('slug') ?? '')
    if (slug) {
      const jar = await cookies()
      jar.set(WORKSPACE_COOKIE_NAME, slug, { httpOnly: true, sameSite: 'lax', path: '/' })
    }
    revalidatePath('/', 'layout')
  }

  async function endSession() {
    'use server'
    await signOut({ redirectTo: '/signin' })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-ink-900">
              Agentic Data Product Management
            </Link>
            <Badge tone="info" title="Agents act. Humans decide.">
              Supervised autonomy
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <form action={switchWorkspace} className="flex items-center gap-2">
              <label htmlFor="workspace" className="text-xs text-ink-600">
                Workspace
              </label>
              <select
                id="workspace"
                name="slug"
                defaultValue={session.workspaceSlug}
                className="rounded-md border border-ink-300 bg-white px-2 py-1 text-sm"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.slug}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-ink-300 px-2 py-1 text-xs hover:bg-ink-50"
              >
                Switch
              </button>
            </form>
            <span className="text-ink-700">
              {session.name}
              <span className="ml-1 text-xs text-ink-500">
                ({session.roles.map(roleName).join(', ') || 'no roles'})
              </span>
            </span>
            <form action={endSession}>
              <button type="submit" className="rounded-md border border-ink-300 px-2 py-1 text-xs hover:bg-ink-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-6 pb-3">
          <MainNav />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1400px] px-6 py-8">
        {children}
      </main>
      <TourOverlay tours={GUIDED_TOURS} />
      <footer className="mx-auto max-w-[1400px] px-6 pb-10 text-xs text-ink-500">
        ADPM designs, governs and manages data products. It does not run pipelines, execute
        transformations or query a warehouse — and no agent can approve, commit or publish anything.
      </footer>
    </div>
  )
}
