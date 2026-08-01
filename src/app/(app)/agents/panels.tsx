'use client'

import { useActionState } from 'react'
import { runScheduledSteward } from './actions'
import { Button, ErrorText, Field, inputClass } from '@/components/ui'

export function StewardRunForm({ products }: { products: { id: string; name: string }[] }) {
  const [result, formAction, pending] = useActionState<{ ok?: string; error?: string } | undefined, FormData>(
    runScheduledSteward,
    undefined,
  )

  if (products.length === 0) {
    return <p className="text-sm text-ink-600">No published product to monitor yet.</p>
  }

  return (
    <form action={formAction}>
      <Field label="Published product" htmlFor="steward-product" required>
        <select id="steward-product" name="productId" className={inputClass} required>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </Field>
      <Button disabled={pending} variant="secondary">
        {pending ? 'Running…' : 'Run scheduled monitoring now'}
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
