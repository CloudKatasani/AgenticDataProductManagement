/**
 * `pnpm monitor` — the scheduled monitoring run, for cron or a launchd/Task Scheduler entry.
 *
 * This is the only part of ADPM that runs without a person sitting in front of it, so it is the
 * place where "agents act, humans decide" is easiest to quietly break. It does not:
 *
 *   * approve anything — it never touches a Gate; only recordDecision() can, and only from a session;
 *   * commit anything — findings become tasks and change requests, never artifact versions;
 *   * run unattributed — ADPM_MONITOR_USER names the human accountable for the schedule, that
 *     human is authorised server-side like any other actor, and their id is written to every
 *     AgentAction the run produces;
 *   * escape the autonomy ceiling — invokeAgent() refuses a SCHEDULE trigger below L3, so an
 *     agent an admin has not deliberately raised to L3 simply does not run here.
 *
 * Everything it produces is waiting in a human's inbox the next morning. That is the whole point.
 *
 * Usage:
 *   ADPM_MONITOR_USER=steward@adpm.local pnpm monitor
 *   ADPM_MONITOR_USER=steward@adpm.local pnpm monitor --workspace=utility-energy --dry-run
 */
import { prisma } from '@/lib/db'
import { AGENTS } from '@/lib/agents/registry'
import { effectiveAutonomy, invokeAgent } from '@/lib/agents/runtime'
import { getStage } from '@/lib/lifecycle/stages'

interface Options {
  userEmail: string
  workspaceSlug?: string
  dryRun: boolean
}

function readOptions(argv: string[]): Options {
  const flag = (name: string): string | undefined => {
    const match = argv.find((a) => a.startsWith(`--${name}=`))
    return match ? match.slice(name.length + 3) : undefined
  }
  const userEmail = flag('user') ?? process.env.ADPM_MONITOR_USER ?? ''
  if (!userEmail) {
    throw new Error(
      'No accountable human named. Set ADPM_MONITOR_USER=<email> or pass --user=<email>.\n' +
        'A scheduled agent run is still someone\'s run; ADPM will not record one against nobody.',
    )
  }
  return { userEmail, workspaceSlug: flag('workspace'), dryRun: argv.includes('--dry-run') }
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2))

  const user = await prisma.user.findUnique({ where: { email: options.userEmail } })
  if (!user) throw new Error(`No user with email ${options.userEmail}.`)

  const workspaces = await prisma.workspace.findMany({
    where: {
      agentsEnabled: true,
      ...(options.workspaceSlug ? { slug: options.workspaceSlug } : {}),
    },
    orderBy: { name: 'asc' },
  })
  if (workspaces.length === 0) {
    console.log('No workspace has agents enabled. Nothing to monitor; this is not an error.')
    return
  }

  let ran = 0
  let skipped = 0
  let findings = 0

  for (const workspace of workspaces) {
    const products = await prisma.dataProduct.findMany({
      where: { workspaceId: workspace.id, status: 'PUBLISHED', archivedAt: null },
      orderBy: { name: 'asc' },
    })
    if (products.length === 0) continue

    console.log(`\n${workspace.name} — ${products.length} published product(s)`)

    for (const product of products) {
      // Monitoring runs on the stage the product actually sits in, not a stage we assume.
      const stage = getStage(product.currentStage)
      for (const agent of AGENTS) {
        if (agent.autonomyCeiling !== 'L3') continue
        if (agent.stages.length > 0 && !agent.stages.includes(stage.number)) continue
        if (!stage.permittedAgents.includes(agent.id)) continue

        const autonomy = await effectiveAutonomy(workspace.id, agent)
        if (autonomy !== 'L3') {
          skipped += 1
          console.log(
            `  · ${product.name} / ${agent.name}: at ${autonomy}, not scheduled. Raise it to L3 in Admin to include it.`,
          )
          continue
        }
        if (options.dryRun) {
          skipped += 1
          console.log(`  · ${product.name} / ${agent.name}: would run (dry run).`)
          continue
        }

        try {
          const result = await invokeAgent({
            agentId: agent.id,
            workspaceId: workspace.id,
            productId: product.id,
            stageNumber: stage.number,
            userId: user.id,
            trigger: 'SCHEDULE',
          })
          ran += 1
          findings += result.findingCount
          console.log(
            `  ✓ ${product.name} / ${agent.name}: ${result.findingCount} finding(s), ` +
              `${result.commentCount} comment(s), $${result.estimatedCostUsd.toFixed(4)} — ` +
              'awaiting human disposition.',
          )
        } catch (error) {
          skipped += 1
          const reason = error instanceof Error ? error.message : String(error)
          // A refusal here is the guardrails working. Report it; do not treat it as a crash.
          console.log(`  · ${product.name} / ${agent.name}: not run — ${reason}`)
        }
      }
    }
  }

  console.log(
    `\n${ran} run(s), ${skipped} skipped, ${findings} finding(s) raised for ${user.email} to disposition.` +
      '\nNothing was approved, published or committed. Open /inbox to act on the findings.',
  )
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
