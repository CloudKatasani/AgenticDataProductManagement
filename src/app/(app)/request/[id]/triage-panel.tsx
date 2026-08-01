'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { triageRequest } from '../actions'
import type { NearMatch } from '@/lib/requests/duplicates'
import { REQUEST_TERMINAL_STATES, type RequestState } from '@/lib/domain/enums'
import { Badge, Button, Card, CardBody, CardHeader, ErrorText, Field, inputClass } from '@/components/ui'

const ACTIONS = [
  { value: 'APPROVE', label: 'Approve', hint: 'Creates a Data Product at Stage 1 with the decision register pre-populated.' },
  { value: 'INFO', label: 'Request more information', hint: 'Returns to the requester with your question in the thread.' },
  { value: 'DECLINE', label: 'Decline', hint: 'Needs a written reason the requester can read.' },
  { value: 'MERGE', label: 'Merge', hint: 'Attach this consumer to an existing product instead.' },
  { value: 'DEFER', label: 'Defer', hint: 'Valid, but not now. It keeps ageing in the portfolio.' },
] as const

export function TriagePanel({
  requestId,
  state,
  domains,
  products,
  nearMatches,
}: {
  requestId: string
  state: string
  domains: { id: string; name: string }[]
  products: { id: string; name: string }[]
  nearMatches: NearMatch[]
}) {
  const [action, setAction] = useState<string>('APPROVE')
  const [result, formAction, pending] = useActionState<
    { ok?: string; error?: string; productId?: string } | undefined,
    FormData
  >(triageRequest, undefined)

  const terminal = REQUEST_TERMINAL_STATES.includes(state as RequestState)

  return (
    <Card>
      <CardHeader
        title="Triage"
        description="Four real actions. Every one of them writes an audit event and is visible to the requester."
      />
      <CardBody>
        {nearMatches.length > 0 ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Near matches</p>
            <ul className="mt-1 space-y-1 text-sm">
              {nearMatches.map((match) => (
                <li key={match.id}>
                  <Link href={match.href} className="text-accent-700 underline">
                    {match.name}
                  </Link>{' '}
                  <Badge>{Math.round(match.score * 100)}%</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {terminal ? (
          <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
            This request is {state}. A terminal request cannot be revived — raise a new one instead.
          </p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <Field label="Action" htmlFor="action" required>
              <select
                id="action"
                name="action"
                className={inputClass}
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                {ACTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="-mt-2 mb-3 text-xs text-ink-600">
              {ACTIONS.find((entry) => entry.value === action)?.hint}
            </p>

            {action === 'APPROVE' ? (
              <Field label="Domain" htmlFor="domainId" required>
                <select id="domainId" name="domainId" className={inputClass} required>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {action === 'MERGE' ? (
              <Field label="Merge into" htmlFor="mergeIntoProductId" required>
                <select id="mergeIntoProductId" name="mergeIntoProductId" className={inputClass} required>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field
              label={action === 'DECLINE' ? 'Reason (visible to the requester)' : 'Note'}
              htmlFor="note"
              required={action === 'DECLINE' || action === 'INFO'}
            >
              <textarea
                id="note"
                name="note"
                rows={3}
                className={inputClass}
                required={action === 'DECLINE' || action === 'INFO'}
              />
            </Field>

            <Button disabled={pending}>{pending ? 'Recording…' : 'Record triage decision'}</Button>
            {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
            {result?.ok ? (
              <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {result.ok}{' '}
                {result.productId ? (
                  <Link href={`/products/${result.productId}`} className="underline">
                    Open the product
                  </Link>
                ) : null}
              </p>
            ) : null}
          </form>
        )}
      </CardBody>
    </Card>
  )
}
