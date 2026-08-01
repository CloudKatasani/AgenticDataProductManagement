import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { ROLES } from '@/lib/domain/roles'
import { STANDARDS_ADAPTERS } from '@/lib/standards'
import { validatePack } from '@/lib/packs/schema'
import { credentialStatus } from '@/lib/secrets'
import { Badge, Card, CardBody, CardHeader, Callout, LinkButton, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await requireSession()
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } })
  const packRow = await prisma.pack.findUnique({ where: { key: workspace.packKey } })
  const pack = packRow ? validatePack(JSON.parse(packRow.contentJson)) : undefined
  const assignments = await prisma.roleAssignment.findMany({
    where: { workspaceId: session.workspaceId },
    include: { user: true, role: true },
    orderBy: { role: { sortOrder: 'asc' } },
  })
  const credentials = await credentialStatus()
  const packs = await prisma.pack.findMany({ orderBy: { name: 'asc' } })

  return (
    <div>
      <PageHeader
        eyebrow="Run"
        title="Admin"
        description={`Packs, roles, controls, standards and configuration for ${workspace.name}.`}
      />

      <Callout tone="warn" title="Packs are illustrative and editable, not authoritative.">
        <p>
          Pack content — domains, controls, metrics, blueprints — is a starting point for a
          conversation with your own regulatory and domain experts. It is not legal advice, and it is
          not a compliance certification.
        </p>
      </Callout>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Installed packs"
            description="Industry logic lives here, never in application code."
          />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {packs.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium text-ink-900">{entry.name}</span>{' '}
                    <span className="text-xs text-ink-500">
                      v{entry.version} · {entry.sourcePath}
                    </span>
                  </span>
                  {entry.key === workspace.packKey ? <Badge tone="good">active</Badge> : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-600">
              Validate every pack with <code className="rounded bg-ink-100 px-1">pnpm pack:validate</code>.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Role assignment" description="Roles are per workspace and enforced server-side." />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-2">Role</th>
                  <th className="px-3 py-2">Assigned to</th>
                  <th className="px-5 py-2">Door</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-t border-ink-100">
                    <td className="px-5 py-2 text-ink-800">{assignment.role.name}</td>
                    <td className="px-3 py-2 text-ink-700">{assignment.user.name}</td>
                    <td className="px-5 py-2 text-xs text-ink-500">{assignment.role.door}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Control and regulatory library"
            description={pack ? `${pack.controls.length} controls from ${pack.name}` : 'No pack loaded'}
          />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {pack?.controls.map((control) => (
                <li key={control.key}>
                  <span className="font-medium text-ink-900">{control.name}</span>{' '}
                  <Badge>{control.category}</Badge>
                  <p className="text-xs text-ink-600">{control.requirement}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Standards interoperability"
            description="Each adapter pins a specification version and is covered by a round-trip or shape test. A pinned, tested mapping is not the same as a certified one — the badge says which you are looking at."
          />
          <CardBody>
            <ul className="space-y-3 text-sm">
              {STANDARDS_ADAPTERS.map((adapter) => (
                <li key={adapter.key}>
                  <span className="font-medium text-ink-900">{adapter.name}</span>{' '}
                  <Badge tone="info">{adapter.version}</Badge>{' '}
                  <Badge tone={adapter.direction === 'EXPORT_ONLY' ? 'neutral' : 'good'}>
                    {adapter.direction === 'EXPORT_ONLY' ? 'export only' : 'round-trip'}
                  </Badge>{' '}
                  <Badge tone={adapter.verification ? 'good' : 'warn'}>
                    {adapter.verification
                      ? `checked against the spec ${adapter.verification.checkedOn}`
                      : 'unverified against the spec'}
                  </Badge>
                  <p className="text-xs text-ink-600">{adapter.note}</p>
                  {adapter.verification ? (
                    <p className="mt-1 text-xs text-ink-500">
                      <span className="font-medium">{adapter.verification.source}</span> —{' '}
                      {adapter.verification.finding}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Agent configuration" />
          <CardBody className="text-sm text-ink-700">
            <p>
              Agents are <strong>{workspace.agentsEnabled ? 'enabled' : 'disabled'}</strong>; sample-data
              access is <strong>{workspace.agentsMaySeeSampleData ? 'on' : 'off'}</strong>; budget cap $
              {workspace.agentBudgetUsd.toFixed(2)} with ${workspace.agentSpendUsd.toFixed(2)} spent.
            </p>
            <p className="mt-2">
              Provider credentials are {credentials.configured ? `configured (${credentials.hint})` : 'not configured'}.
              Keys live in the environment or a git-ignored local file — never in the database and never
              in a committed artifact.
            </p>
            <p className="mt-3">
              <Link href="/agents" className="text-accent-600 underline">
                Configure autonomy levels in the Agents tab
              </Link>
              .
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Exports and seed" />
          <CardBody className="space-y-2 text-sm">
            <p className="text-ink-700">
              Every committed artifact is also mirrored to <code className="rounded bg-ink-100 px-1">workspace/</code>{' '}
              as plain YAML or Markdown, so the whole programme is git-diffable outside this application.
            </p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/api/export/audit">Signed audit bundle (JSON)</LinkButton>
              <LinkButton href="/api/export/portfolio">Portfolio extract (Excel)</LinkButton>
              <LinkButton href="/api/export/primer">Academy primer (PDF)</LinkButton>
            </div>
            <p className="text-xs text-ink-600">
              Reset and reseed the demo data with{' '}
              <code className="rounded bg-ink-100 px-1">pnpm db:reset</code>. It drives every seeded
              product through the real gate engine, so a broken engine fails the seed.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Roles reference" description="The registry the RACI matrix is computed from." />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-2">Role</th>
                <th className="px-3 py-2">Door</th>
                <th className="px-3 py-2">Owns</th>
                <th className="px-5 py-2">Seed account</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role.key} className="border-t border-ink-100">
                  <td className="px-5 py-2 text-ink-800">{role.name}</td>
                  <td className="px-3 py-2 text-xs text-ink-500">{role.door}</td>
                  <td className="px-3 py-2 text-xs text-ink-600">{role.owns}</td>
                  <td className="px-5 py-2 font-mono text-xs text-ink-600">{role.seedEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}
