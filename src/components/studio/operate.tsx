'use client'

import { useActionState } from 'react'
import { measureValueAction, raiseChangeRequestAction, type Result } from '@/app/(app)/products/actions'
import { Badge, Button, Card, CardBody, CardHeader, ErrorText, Field, inputClass } from '@/components/ui'

export function ChangeRequestPanel({ productId }: { productId: string }) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    raiseChangeRequestAction,
    undefined,
  )
  return (
    <Card>
      <CardHeader
        title="Raise a change request"
        description="Accepting one bumps the semantic version. A major bump is how a breaking change becomes visible to consumers."
      />
      <CardBody>
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <Field label="Title" htmlFor="cr-title" required>
            <input id="cr-title" name="title" className={inputClass} required />
          </Field>
          <Field label="Detail" htmlFor="cr-detail">
            <textarea id="cr-detail" name="detail" rows={3} className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Severity" htmlFor="cr-severity">
              <select id="cr-severity" name="severity" className={inputClass} defaultValue="MEDIUM">
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
            </Field>
            <Field label="Version bump" htmlFor="cr-bump">
              <select id="cr-bump" name="versionBump" className={inputClass} defaultValue="PATCH">
                <option>PATCH</option>
                <option>MINOR</option>
                <option>MAJOR</option>
              </select>
            </Field>
          </div>
          <Button disabled={pending} variant="secondary">
            {pending ? 'Raising…' : 'Raise change request'}
          </Button>
          {result?.ok ? (
            <p role="status" className="mt-2 text-sm text-emerald-700">
              {result.ok}
            </p>
          ) : null}
          {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
        </form>
      </CardBody>
    </Card>
  )
}

export function ValuePanel({
  productId,
  value,
  canMeasure,
}: {
  productId: string
  value?: {
    baseline: number | null
    measuredValue: number | null
    unit: string
    state: string
    dueAt: string | null
    note: string
  }
  canMeasure: boolean
}) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    measureValueAction,
    undefined,
  )
  return (
    <Card>
      <CardHeader
        title="Value realisation"
        description="The Stage 2 hypothesis, measured. “Not yet measurable” ages and reports."
        actions={
          value ? (
            <Badge
              tone={value.state === 'REALISED' ? 'good' : value.state === 'NOT_REALISED' ? 'bad' : 'warn'}
            >
              {value.state}
            </Badge>
          ) : null
        }
      />
      <CardBody>
        {value ? (
          <p className="mb-3 text-sm text-ink-700">
            Baseline {value.baseline ?? '—'} {value.unit}
            {value.measuredValue !== null ? ` · measured ${value.measuredValue} ${value.unit}` : ''}
            {value.dueAt ? ` · due ${new Date(value.dueAt).toLocaleDateString('en-GB')}` : ''}
            {value.note ? ` · ${value.note}` : ''}
          </p>
        ) : (
          <p className="mb-3 text-sm text-ink-600">No value hypothesis recorded.</p>
        )}
        {canMeasure ? (
          <form action={formAction}>
            <input type="hidden" name="productId" value={productId} />
            <Field label="Measured value" htmlFor="measuredValue" required>
              <input id="measuredValue" name="measuredValue" type="number" step="any" className={inputClass} required />
            </Field>
            <Field label="State" htmlFor="value-state" required>
              <select id="value-state" name="state" className={inputClass} defaultValue="REALISED">
                <option value="REALISED">Realised</option>
                <option value="NOT_REALISED">Not realised</option>
                <option value="NOT_YET_MEASURABLE">Not yet measurable</option>
              </select>
            </Field>
            <Field label="Evidence / note" htmlFor="value-note">
              <textarea id="value-note" name="note" rows={2} className={inputClass} />
            </Field>
            <Button disabled={pending} variant="secondary">
              {pending ? 'Recording…' : 'Record measurement'}
            </Button>
            {result?.ok ? (
              <p role="status" className="mt-2 text-sm text-emerald-700">
                {result.ok}
              </p>
            ) : null}
            {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
          </form>
        ) : null}
      </CardBody>
    </Card>
  )
}
