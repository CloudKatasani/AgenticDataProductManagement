import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { ROLES, type RoleKey } from '@/lib/domain/roles'
import { rolesForUser } from './authorise'

/**
 * Session identity comes from the auth cookie; the role set is re-derived from the database on
 * every call. A role claim is never read from the client (invariant 10).
 */

const WORKSPACE_COOKIE = 'adpm.workspace'

export interface SessionContext {
  userId: string
  name: string
  email: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  packKey: string
  roles: RoleKey[]
  /** The door this user lands in by default. */
  door: 'CONSUMER' | 'PRACTITIONER' | 'LEADERSHIP' | 'ADMIN'
}

export async function currentUser() {
  const session = await auth()
  if (!session?.user?.id) return undefined
  return prisma.user.findUnique({ where: { id: session.user.id } })
}

export async function requireSession(): Promise<SessionContext> {
  const session = await sessionOrNull()
  if (!session) redirect('/signin')
  return session
}

/** Route-handler variant: returns undefined rather than redirecting. */
export async function sessionOrNull(): Promise<SessionContext | undefined> {
  const user = await currentUser()
  if (!user) return undefined

  const jar = await cookies()
  const requestedSlug = jar.get(WORKSPACE_COOKIE)?.value

  const assignments = await prisma.roleAssignment.findMany({
    where: { userId: user.id },
    include: { workspace: true },
  })
  if (assignments.length === 0) {
    throw new Error(`${user.email} holds no role in any workspace. Ask an admin to assign one.`)
  }

  const workspace =
    assignments.find((a) => a.workspace.slug === requestedSlug)?.workspace ??
    assignments.find((a) => a.workspace.slug === 'utility-energy')?.workspace ??
    assignments[0]!.workspace

  const roles = await rolesForUser(user.id, workspace.id)
  const door = doorFor(roles)

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    packKey: workspace.packKey,
    roles,
    door,
  }
}

function doorFor(roles: RoleKey[]): SessionContext['door'] {
  const definitions = ROLES.filter((r) => roles.includes(r.key))
  if (definitions.some((r) => r.door === 'PRACTITIONER')) return 'PRACTITIONER'
  if (definitions.some((r) => r.door === 'LEADERSHIP')) return 'LEADERSHIP'
  if (definitions.some((r) => r.door === 'ADMIN')) return 'ADMIN'
  return 'CONSUMER'
}

export function landingPathFor(door: SessionContext['door']): string {
  switch (door) {
    case 'PRACTITIONER':
      return '/inbox'
    case 'LEADERSHIP':
      return '/portfolio'
    case 'ADMIN':
      return '/admin'
    default:
      return '/marketplace'
  }
}

export async function listWorkspacesForUser(userId: string) {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: { workspace: true },
    distinct: ['workspaceId'],
  })
  return assignments
    .map((a) => a.workspace)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const WORKSPACE_COOKIE_NAME = WORKSPACE_COOKIE
