import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { AGENTS, AGENT_FORBIDDEN_ACTIONS } from '@/lib/agents/registry'
import { AUTONOMY_LABELS, AUTONOMY_LEVELS } from '@/lib/domain/enums'
import { credentialStatus } from '@/lib/secrets'
import { artifactTitle } from '@/lib/artifacts/registry'
import { StewardRunForm } from './panels'
import { updateAgentSetting, updateWorkspaceAgentPolicy } from './actions'
import { Badge, Button, Card, CardBody, CardHeader, Callout, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const session = await requireSession()
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } })
  const settings = await prisma.agentSetting.findMany({ where: { workspaceId: session.workspaceId } })
  const settingByAgent = new Map(settings.map((s) => [s.agentId, s]))
  const credentials = await credentialStatus()
  const isAdmin = session.roles.includes('ADMIN')

  const actions = await prisma.agentAction.findMany({
    where: { workspaceId: session.workspaceId },
    include: { product: true, initiatedBy: true, proposals: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const proposals = await prisma.agentProposal.findMany({
    where: { product: { workspaceId: session.workspaceId } },
    include: { agentAction: true, product: true },
  })

  const dispositioned = proposals.filter((p) => p.state !== 'PENDING')
  const accepted = proposals.filter((p) => p.state === 'ACCEPTED')
  const edited = proposals.filter((p) => p.state === 'EDITED')
  const rejected = proposals.filter((p) => p.state === 'REJECTED')
  const pending = proposals.filter((p) => p.state === 'PENDING')

  const spendByAgent = new Map<string, number>()
  for (const action of actions) {
    spendByAgent.set(action.agentId, (spendByAgent.get(action.agentId) ?? 0) + action.estimatedCostUsd)
  }

  const publishedProducts = await prisma.dataProduct.findMany({
    where: { workspaceId: session.workspaceId, status: 'PUBLISHED' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <PageHeader
        eyebrow="Enable"
        title="Agents"
        description="Agents act. Humans decide. Every charter, scope, autonomy level and cost is on this page."
      />

      <Callout tone="info" title="There is no autonomy level that clears a gate.">
        <p>
          L3 is the ceiling and L3 is read-only monitoring. No configuration, admin override or
          &ldquo;trusted mode&rdquo; lets an agent {AGENT_FORBIDDEN_ACTIONS.slice(0, 4).join(', ')}. When a
          client asks whether full automation can be turned on, the honest answer — and the product&rsquo;s
          differentiator — is no. This is enforced in code and asserted in a test.
        </p>
      </Callout>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Proposal acceptance rate</p>
          <p className="mt-1 text-xl font-semibold">
            {dispositioned.length
              ? `${Math.round(((accepted.length + edited.length) / dispositioned.length) * 100)}%`
              : 'no runs yet'}
          </p>
          <p className="text-xs text-ink-500">{dispositioned.length} dispositioned</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Human edit rate</p>
          <p className="mt-1 text-xl font-semibold">
            {dispositioned.length ? `${Math.round((edited.length / dispositioned.length) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-ink-500">{edited.length} edited before accepting</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Rejected</p>
          <p className="mt-1 text-xl font-semibold">{rejected.length}</p>
          <p className="text-xs text-ink-500">{pending.length} awaiting disposition</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Agent spend</p>
          <p className="mt-1 text-xl font-semibold">${workspace.agentSpendUsd.toFixed(2)}</p>
          <p className="text-xs text-ink-500">
            of ${workspace.agentBudgetUsd.toFixed(2)} budget — hard stop when exhausted
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Registry and charters" description="Held as data. Adding an agent never touches the transition engine." />
            <CardBody className="space-y-4">
              {AGENTS.map((agent) => {
                const setting = settingByAgent.get(agent.id)
                return (
                  <div key={agent.id} className="rounded-md border border-ink-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">{agent.name}</h3>
                      <span className="flex gap-2">
                        <Badge tone="agent">ceiling {agent.autonomyCeiling}</Badge>
                        <Badge tone={setting?.enabled ? 'good' : 'neutral'}>
                          {setting?.enabled ? setting.autonomyLevel : 'L0 off'}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-700">{agent.charter}</p>
                    <p className="mt-2 text-xs text-ink-500">
                      Stages: {agent.stages.length ? agent.stages.join(', ') : 'all'} · Reads:{' '}
                      {agent.readScope.map(artifactTitle).join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">Escalation: {agent.escalationRule}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Spend: ${(spendByAgent.get(agent.id) ?? 0).toFixed(4)}
                    </p>
                    {isAdmin ? (
                      <form action={updateAgentSetting} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="agentId" value={agent.id} />
                        <div>
                          <label htmlFor={`level-${agent.id}`} className="mb-1 block text-xs text-ink-600">
                            Autonomy
                          </label>
                          <select
                            id={`level-${agent.id}`}
                            name="autonomyLevel"
                            defaultValue={setting?.autonomyLevel ?? 'L1'}
                            className="rounded-md border border-ink-300 px-2 py-1 text-sm"
                          >
                            {AUTONOMY_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {level} — {AUTONOMY_LABELS[level].name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink-700">
                          <input type="checkbox" name="enabled" defaultChecked={setting?.enabled ?? true} />
                          Enabled
                        </label>
                        <Button variant="secondary">Save</Button>
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Action log"
              description="Append-only. Agent, trigger, scope, input hash, model, tokens, cost, output and human disposition."
            />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-2">When</th>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Product / stage</th>
                    <th className="px-3 py-2">Trigger</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Cost</th>
                    <th className="px-5 py-2">Disposition</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-4 text-sm text-ink-600">
                        No agent has run in this workspace yet.
                      </td>
                    </tr>
                  ) : null}
                  {actions.map((action) => (
                    <tr key={action.id} className="border-t border-ink-100">
                      <td className="px-5 py-2 text-xs text-ink-500">
                        {action.createdAt.toLocaleString('en-GB')}
                      </td>
                      <td className="px-3 py-2 text-xs">{action.agentId}</td>
                      <td className="px-3 py-2 text-xs">
                        {action.product ? (
                          <Link
                            href={`/products/${action.productId}/stage/${action.stageNumber ?? 1}`}
                            className="text-accent-600 hover:underline"
                          >
                            {action.product.name}
                          </Link>
                        ) : (
                          '—'
                        )}{' '}
                        · S{action.stageNumber}
                      </td>
                      <td className="px-3 py-2 text-xs">{action.trigger}</td>
                      <td className="px-3 py-2 font-mono text-xs">{action.model}</td>
                      <td className="px-3 py-2 text-xs">${action.estimatedCostUsd.toFixed(4)}</td>
                      <td className="px-5 py-2 text-xs">
                        <Badge
                          tone={
                            action.disposition === 'PENDING'
                              ? 'warn'
                              : action.disposition === 'REJECTED'
                                ? 'bad'
                                : 'good'
                          }
                        >
                          {action.disposition}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Autonomy levels" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                {AUTONOMY_LEVELS.map((level) => (
                  <div key={level}>
                    <dt className="font-medium text-ink-900">
                      {level} — {AUTONOMY_LABELS[level].name}
                    </dt>
                    <dd className="text-ink-600">{AUTONOMY_LABELS[level].behaviour}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader
                title="Workspace policy"
                description="Disabled by default. The API key is stored outside the database and never in an artifact."
              />
              <CardBody>
                <form action={updateWorkspaceAgentPolicy} className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="agentsEnabled" defaultChecked={workspace.agentsEnabled} />
                    Agents enabled in this workspace
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="agentsMaySeeSampleData"
                      defaultChecked={workspace.agentsMaySeeSampleData}
                    />
                    Agents may see sample data (default off)
                  </label>
                  <div>
                    <label htmlFor="agentBudgetUsd" className="mb-1 block text-xs text-ink-600">
                      Budget cap (USD)
                    </label>
                    <input
                      id="agentBudgetUsd"
                      name="agentBudgetUsd"
                      type="number"
                      step="0.01"
                      defaultValue={workspace.agentBudgetUsd}
                      className="w-full rounded-md border border-ink-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="apiKey" className="mb-1 block text-xs text-ink-600">
                      Anthropic API key {credentials.configured ? `(configured ${credentials.hint})` : '(not set)'}
                    </label>
                    <input
                      id="apiKey"
                      name="apiKey"
                      type="password"
                      autoComplete="off"
                      placeholder="sk-ant-…"
                      className="w-full rounded-md border border-ink-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="model" className="mb-1 block text-xs text-ink-600">
                      Model
                    </label>
                    <input
                      id="model"
                      name="model"
                      defaultValue={credentials.model ?? 'claude-opus-5'}
                      className="w-full rounded-md border border-ink-300 px-2 py-1"
                    />
                  </div>
                  <Button variant="secondary">Save policy</Button>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Supervision queue"
              description="Proposals no human has dispositioned yet. These block artifact submission."
            />
            <CardBody>
              {pending.length === 0 ? (
                <p className="text-sm text-ink-600">Nothing awaiting disposition.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {pending.slice(0, 12).map((proposal) => (
                    <li key={proposal.id}>
                      <Link
                        href={`/products/${proposal.productId}/stage/${proposal.stageNumber}`}
                        className="text-accent-600 hover:underline"
                      >
                        {proposal.product.name} — {proposal.fieldPath}
                      </Link>
                      <span className="ml-2 text-xs text-ink-500">{proposal.agentAction.agentId}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Scheduled monitoring (L3)"
              description="The Steward runs against a published product, raises findings, and edits nothing."
            />
            <CardBody>
              <StewardRunForm products={publishedProducts} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
