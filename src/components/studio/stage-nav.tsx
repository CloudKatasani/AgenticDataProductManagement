import Link from 'next/link'
import { clsx } from 'clsx'
import { STAGES } from '@/lib/lifecycle/stages'

export function StageNav({
  productId,
  current,
  gateStates,
}: {
  productId: string
  current: number
  gateStates: Map<number, string>
}) {
  return (
    <nav aria-label="Lifecycle stages" className="mb-6 flex flex-wrap gap-1.5">
      {STAGES.map((stage) => {
        const state = gateStates.get(stage.number)
        const tone =
          state === 'APPROVED'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : state === 'STALE'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : state === 'REJECTED'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : state === 'OPEN'
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-ink-200 bg-white text-ink-600'
        return (
          <Link
            key={stage.number}
            href={`/products/${productId}/stage/${stage.number}`}
            aria-current={stage.number === current ? 'page' : undefined}
            title={`${stage.name} — ${state ?? 'not started'}`}
            className={clsx(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium',
              tone,
              stage.number === current && 'ring-2 ring-accent-600 ring-offset-1',
            )}
          >
            <span className="font-mono">{stage.number}</span>
            <span className="ml-1.5 hidden sm:inline">{stage.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
