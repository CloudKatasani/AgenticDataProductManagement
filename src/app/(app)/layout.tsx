import Link from 'next/link'
import { signOut } from '@/auth'
import { MainNav } from '@/components/nav'
import { TourOverlay } from '@/components/tour'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import { GUIDED_TOURS } from '@/lib/guides/registry'
import { requireSession, listWorkspacesForUser } from '@/lib/auth/session'
import { roleName } from '@/lib/domain/roles'
import { Badge } from '@/components/ui'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const workspaces = await listWorkspacesForUser(session.userId)

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
            <WorkspaceSwitcher
              workspaces={workspaces.map((workspace) => ({
                id: workspace.id,
                slug: workspace.slug,
                name: workspace.name,
              }))}
              activeSlug={session.workspaceSlug}
            />
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
