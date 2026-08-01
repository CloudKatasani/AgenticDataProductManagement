import { NextResponse } from 'next/server'
import { sessionOrNull } from '@/lib/auth/session'
import { hasAnyRole } from '@/lib/auth/authorise'
import { buildAuditBundle } from '@/lib/exports/audit'

export async function GET() {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const permitted = await hasAnyRole(session.userId, session.workspaceId, [
    'ADMIN',
    'GOVERNANCE_COUNCIL',
    'PORTFOLIO_LEAD',
    'PRIVACY_SECURITY_OFFICER',
  ])
  if (!permitted) {
    return NextResponse.json(
      { error: 'The audit bundle is restricted to admin, governance, portfolio and privacy roles.' },
      { status: 403 },
    )
  }

  const { bundle, digest } = await buildAuditBundle(session.workspaceId)
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${session.workspaceSlug}-audit-${digest.slice(0, 12)}.json"`,
    },
  })
}
