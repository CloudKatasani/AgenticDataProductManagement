'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { runScheduledSteward, updateModelAssignment } from './actions'
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

export interface TargetOption {
  workspaceId: string
  industry: string
  workspaceName: string
  domains: { key: string; name: string }[]
  products: { id: string; name: string; domainKey: string; stage: number; status: string }[]
}

/**
 * Industry → domain → data product, narrowing down to the thing an agent will actually run
 * against. Filtering happens client-side because the whole option set is already on the page and
 * a round trip per select would be worse; the *authority* to configure or run anything is
 * re-derived server-side in the actions, never from these fields.
 */
export function AgentTargeting({
  targets,
  initialWorkspaceId,
  assignmentsByWorkspace,
  models,
  levels,
  isAdmin,
}: {
  targets: TargetOption[]
  initialWorkspaceId: string
  assignmentsByWorkspace: Record<string, Record<string, string>>
  models: {
    id: string
    name: string
    tier: string
    bestFor: string
    pricePerMillionInput: number
    pricePerMillionOutput: number
    suitedTo: string[]
  }[]
  levels: { level: string; name: string; behaviour: string }[]
  isAdmin: boolean
}) {
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId)
  const [domainKey, setDomainKey] = useState('')
  const [productId, setProductId] = useState('')

  const target = targets.find((t) => t.workspaceId === workspaceId) ?? targets[0]
  const domainProducts = target
    ? target.products.filter((p) => !domainKey || p.domainKey === domainKey)
    : []
  const product = domainProducts.find((p) => p.id === productId)
  const assignments = assignmentsByWorkspace[workspaceId] ?? {}

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="target-industry" className="mb-1 block text-xs font-medium text-ink-700">
            Industry
          </label>
          <select
            id="target-industry"
            className={inputClass}
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value)
              setDomainKey('')
              setProductId('')
            }}
          >
            {targets.map((t) => (
              <option key={t.workspaceId} value={t.workspaceId}>
                {t.industry}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target-domain" className="mb-1 block text-xs font-medium text-ink-700">
            Domain
          </label>
          <select
            id="target-domain"
            className={inputClass}
            value={domainKey}
            onChange={(event) => {
              setDomainKey(event.target.value)
              setProductId('')
            }}
          >
            <option value="">All domains</option>
            {(target?.domains ?? []).map((domain) => (
              <option key={domain.key} value={domain.key}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target-product" className="mb-1 block text-xs font-medium text-ink-700">
            Data product
          </label>
          <select
            id="target-product"
            className={inputClass}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">
              {domainProducts.length} product{domainProducts.length === 1 ? '' : 's'} — choose one
            </option>
            {domainProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {product ? (
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
          <strong>{product.name}</strong> · {product.status} · currently at Stage {product.stage}.{' '}
          <Link
            href={`/products/${product.id}/stage/${product.stage}`}
            className="text-accent-600 underline"
          >
            Open it in the Lifecycle Studio
          </Link>{' '}
          to run an agent against it and disposition what it proposes.
        </p>
      ) : (
        <p className="text-sm text-ink-600">
          Choose a product to see where it sits and jump to its stage. Agents are invoked from the
          stage itself, next to the artifact they propose against — never from a settings screen.
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-ink-900">Model per autonomy level</h3>
        <p className="mt-1 text-xs text-ink-600">
          Applies to <strong>{target?.industry}</strong>. Choosing a more capable model changes what
          an agent is <em>good at</em>, never what it is <em>allowed to do</em>: L3 is read-only
          monitoring whichever model backs it, and no model clears a gate.
        </p>
        <div className="mt-3 space-y-3">
          {levels.map((level) => (
            <ModelAssignmentRow
              key={level.level}
              workspaceId={workspaceId}
              level={level}
              models={models}
              current={assignments[level.level]}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModelAssignmentRow({
  workspaceId,
  level,
  models,
  current,
  isAdmin,
}: {
  workspaceId: string
  level: { level: string; name: string; behaviour: string }
  models: {
    id: string
    name: string
    tier: string
    bestFor: string
    pricePerMillionInput: number
    pricePerMillionOutput: number
    suitedTo: string[]
  }[]
  current?: string
  isAdmin: boolean
}) {
  const [result, formAction, pending] = useActionState<
    { ok?: string; error?: string } | undefined,
    FormData
  >(updateModelAssignment, undefined)
  const selected = models.find((m) => m.id === current)

  return (
    <div className="rounded-md border border-ink-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-800">
          {level.level}
        </span>
        <span className="text-sm font-medium text-ink-900">{level.name}</span>
        <span className="text-xs text-ink-500">{level.behaviour}</span>
      </div>
      {isAdmin ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="autonomyLevel" value={level.level} />
          <div className="min-w-[240px] flex-1">
            <label htmlFor={`model-${level.level}`} className="mb-1 block text-xs text-ink-600">
              Model
            </label>
            <select
              id={`model-${level.level}`}
              name="modelId"
              defaultValue={current}
              className={inputClass}
              key={`${workspaceId}-${current}`}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                  {model.suitedTo.includes(level.level) ? ' — suggested' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" disabled={pending}>
            {pending ? 'Saving…' : 'Assign'}
          </Button>
        </form>
      ) : (
        <p className="mt-1 text-sm text-ink-700">
          Currently {selected?.name ?? current}. Only an admin can change this.
        </p>
      )}
      {selected ? (
        <p className="mt-1 text-xs text-ink-500">
          {selected.bestFor} · ${selected.pricePerMillionInput}/M in, $
          {selected.pricePerMillionOutput}/M out.
        </p>
      ) : null}
      {result?.ok ? (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {result.ok}
        </p>
      ) : null}
      {result?.error ? <ErrorText>{result.error}</ErrorText> : null}
    </div>
  )
}
