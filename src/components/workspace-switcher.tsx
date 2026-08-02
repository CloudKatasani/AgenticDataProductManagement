'use client'

import { usePathname } from 'next/navigation'
import { useActionState } from 'react'
import { switchWorkspaceAction } from '@/app/(app)/workspace-actions'

/**
 * Switching workspace changes which industry every other screen is about, so it has to be
 * unambiguous. Two things this deliberately does:
 *
 *  1. **Submits the current path**, so the action can redirect back to it. A redirect means the
 *     next render is a fresh request that reads the new cookie — relying on revalidation alone
 *     left the header showing the old workspace while the page below showed the new one, which
 *     read as "the switch did not work" and made the next click re-submit the stale value.
 *  2. **Keys the select on the active workspace**, so React remounts it rather than leaving a
 *     mounted uncontrolled `<select>` holding a stale value. `defaultValue` is only applied on
 *     mount; without the key the dropdown drifts out of step with the server.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
}: {
  workspaces: { id: string; slug: string; name: string }[]
  activeSlug: string
}) {
  const pathname = usePathname()
  const [error, formAction, pending] = useActionState<string | undefined, FormData>(
    switchWorkspaceAction,
    undefined,
  )

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="from" value={pathname} />
      <label htmlFor="workspace" className="text-xs text-ink-600">
        Workspace
      </label>
      <select
        key={activeSlug}
        id="workspace"
        name="slug"
        defaultValue={activeSlug}
        disabled={pending}
        className="rounded-md border border-ink-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.slug}>
            {workspace.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-ink-300 px-2 py-1 text-xs hover:bg-ink-50 disabled:opacity-60"
      >
        {pending ? 'Switching…' : 'Switch'}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-rose-700">
          {error}
        </span>
      ) : null}
    </form>
  )
}
