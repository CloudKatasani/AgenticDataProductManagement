'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  landingPathFor,
  listWorkspacesForUser,
  requireSession,
  WORKSPACE_COOKIE_NAME,
} from '@/lib/auth/session'

/**
 * Paths whose meaning is tied to one workspace's records. A product id from the banking workspace
 * means nothing in healthcare, so switching while on one of these returns you to the door's
 * landing page rather than to a deep link that is about to 404 or show a stranger's product.
 */
const RECORD_PATH = /^\/(products|request|marketplace)\/[^/]+/

function safeReturnPath(from: string, door: Parameters<typeof landingPathFor>[0]): string {
  // Never redirect anywhere the caller supplies verbatim: only same-origin absolute paths.
  if (!from.startsWith('/') || from.startsWith('//')) return landingPathFor(door)
  if (RECORD_PATH.test(from)) return landingPathFor(door)
  return from
}

export async function switchWorkspaceAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession()
  const slug = String(formData.get('slug') ?? '').trim()
  const from = String(formData.get('from') ?? '/')

  if (!slug) return 'Choose a workspace.'

  // A slug in a form is a request, never a claim (invariant 10): you can only switch into a
  // workspace you actually hold a role in.
  const permitted = await listWorkspacesForUser(session.userId)
  const target = permitted.find((workspace) => workspace.slug === slug)
  if (!target) return 'You hold no role in that workspace.'

  const jar = await cookies()
  jar.set(WORKSPACE_COOKIE_NAME, target.slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  // Redirect rather than revalidate. A fresh request is the only way to be certain every part of
  // the page — header included — renders from the cookie we just wrote.
  redirect(safeReturnPath(from, session.door))
}
