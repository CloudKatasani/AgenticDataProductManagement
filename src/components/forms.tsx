'use client'

import { useActionState } from 'react'
import { Button, ErrorText } from '@/components/ui'

export interface ActionResult {
  ok?: string
  error?: string
}

type ActionFn = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>

/**
 * A thin wrapper so server actions can report success or failure inline without every page
 * hand-rolling its own state. Progressive enhancement is preserved: the form posts either way.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = 'primary',
}: {
  action: ActionFn
  children: React.ReactNode
  submitLabel: string
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  )
  return (
    <form action={formAction}>
      {children}
      <div className="mt-3 flex items-center gap-3">
        <Button variant={variant} disabled={pending}>
          {pending ? 'Working…' : submitLabel}
        </Button>
        {state?.ok ? (
          <p role="status" className="text-sm text-emerald-700">
            {state.ok}
          </p>
        ) : null}
      </div>
      {state?.error ? <ErrorText>{state.error}</ErrorText> : null}
    </form>
  )
}
