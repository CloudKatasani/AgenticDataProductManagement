import { prisma } from '@/lib/db'
import type { RoleKey } from '@/lib/domain/roles'

/**
 * Invariant 10: roles are re-derived server-side on every mutation. Nothing in this file reads
 * a claim supplied by the client.
 */

export class AuthorisationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorisationError'
  }
}

export async function rolesForUser(userId: string, workspaceId: string): Promise<RoleKey[]> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId, workspaceId },
    include: { role: true },
  })
  return assignments.map((a) => a.role.key as RoleKey)
}

export async function hasAnyRole(
  userId: string,
  workspaceId: string,
  roles: readonly RoleKey[],
): Promise<boolean> {
  if (roles.length === 0) return false
  const held = await rolesForUser(userId, workspaceId)
  return held.some((r) => roles.includes(r))
}

export async function assertRole(
  userId: string,
  workspaceId: string,
  roles: readonly RoleKey[],
  action: string,
): Promise<RoleKey[]> {
  const held = await rolesForUser(userId, workspaceId)
  const matching = held.filter((r) => roles.includes(r))
  if (matching.length === 0) {
    throw new AuthorisationError(
      `${action} requires one of: ${roles.join(', ')}. You hold: ${held.join(', ') || 'no roles in this workspace'}.`,
    )
  }
  return matching
}
