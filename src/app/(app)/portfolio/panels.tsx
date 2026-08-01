'use client'

import { useActionState } from 'react'
import { overridePrioritisation, saveMaturityAssessment } from './actions'
import { MATURITY_DIMENSIONS } from '@/lib/portfolio/maturity'
import { Button, ErrorText, Field, inputClass } from '@/components/ui'

export function PrioritisationOverrideForm({
  products,
}: {
  products: { id: string; name: string }[]
}) {
  const [result, formAction, pending] = useActionState<{ ok?: string; error?: string } | undefined, FormData>(
    overridePrioritisation,
    undefined,
  )
  return (
    <form action={formAction}>
      <p className="mb-2 text-xs text-ink-600">
        Overriding is expected. Overriding without a reason is not possible.
      </p>
      <Field label="Product" htmlFor="override-product" required>
        <select id="override-product" name="productId" className={inputClass} required>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Override score" htmlFor="override-score" required>
        <input id="override-score" name="score" type="number" step="0.01" className={inputClass} required />
      </Field>
      <Field label="Reason" htmlFor="override-reason" required>
        <textarea id="override-reason" name="reason" rows={2} className={inputClass} required />
      </Field>
      <Button disabled={pending} variant="secondary">
        {pending ? 'Recording…' : 'Record override'}
      </Button>
      {result?.ok ? (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {result.ok}
        </p>
      ) : null}
      {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
    </form>
  )
}

export function MaturityForm({ scores }: { scores: Record<string, number> }) {
  const [result, formAction, pending] = useActionState<{ ok?: string; error?: string } | undefined, FormData>(
    saveMaturityAssessment,
    undefined,
  )
  return (
    <details className="rounded-md border border-ink-200 p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink-800">
        Record a new maturity assessment
      </summary>
      <form action={formAction} className="mt-3">
        {MATURITY_DIMENSIONS.map((dimension) => (
          <fieldset key={dimension.key} className="mb-4 border-t border-ink-100 pt-3">
            <legend className="text-sm font-medium text-ink-900">{dimension.name}</legend>
            <p className="mb-2 text-xs text-ink-600">{dimension.question}</p>
            <label htmlFor={`score-${dimension.key}`} className="sr-only">
              {dimension.name} level
            </label>
            <select
              id={`score-${dimension.key}`}
              name={`score-${dimension.key}`}
              className={inputClass}
              defaultValue={String(scores[dimension.key] ?? 1)}
            >
              {dimension.levels.map((description, index) => (
                <option key={description} value={index + 1}>
                  Level {index + 1} — {description}
                </option>
              ))}
            </select>
            <label htmlFor={`note-${dimension.key}`} className="sr-only">
              {dimension.name} note
            </label>
            <input
              id={`note-${dimension.key}`}
              name={`note-${dimension.key}`}
              placeholder="Evidence or note (optional)"
              className={`${inputClass} mt-2`}
            />
          </fieldset>
        ))}
        <Button disabled={pending}>{pending ? 'Saving…' : 'Save assessment'}</Button>
        {result?.ok ? (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            {result.ok}
          </p>
        ) : null}
        {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
      </form>
    </details>
  )
}
