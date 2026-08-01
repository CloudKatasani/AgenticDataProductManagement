import { NextResponse } from 'next/server'
import { sessionOrNull } from '@/lib/auth/session'
import { portfolioRows } from '@/lib/queries/portfolio'
import { buildPortfolioWorkbook } from '@/lib/exports/xlsx'

export async function GET() {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const rows = await portfolioRows(session.workspaceId)
  const buffer = await buildPortfolioWorkbook(
    rows.map((row) => ({
      product: row.name,
      domain: row.domainName,
      owner: row.ownerName,
      status: row.status,
      stage: row.currentStage,
      gatesApproved: row.approvedGates,
      staleGates: row.staleGates,
      buildEffortDays: row.buildEffortDays,
      runCostPerYearUsd: row.runCostPerYearUsd,
      costToServeUsdPerMonth: row.costToServeUsdPerMonth,
      agentSpendUsd: Number(row.agentSpendUsd.toFixed(4)),
      consumers: row.consumers,
      queries30d: row.queries30d,
      daysSinceLastUse: row.daysSinceLastUse ?? '',
      score: row.overrideScore ?? row.score.score,
      scoreOverridden: row.overrideScore === null ? 'no' : 'yes',
      overrideReason: row.overrideReason ?? '',
      valueState: row.valueState,
      valueBaseline: row.valueBaseline ?? '',
      valueMeasured: row.valueMeasured ?? '',
      cycleTimeDays: row.cycleTimeDays ?? '',
      reworkLoops: row.reworkLoops,
    })),
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${session.workspaceSlug}-portfolio.xlsx"`,
    },
  })
}
