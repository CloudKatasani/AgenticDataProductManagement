'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A guided tour drives the real application: each step navigates to the screen it is talking about
 * and the overlay persists across that navigation. It is not a slideshow of screenshots, because a
 * slideshow goes stale the first time the product changes and nobody notices.
 */

export interface TourStep {
  href: string
  title: string
  instruction: string
}

export interface TourDefinition {
  key: string
  title: string
  audience: string
  minutes: number
  steps: TourStep[]
}

const STORAGE_KEY = 'adpm.tour'
const CHANGED_EVENT = 'adpm-tour-changed'

interface TourState {
  key: string
  step: number
}

function readState(): TourState | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as TourState
    return typeof parsed?.key === 'string' && Number.isInteger(parsed.step) ? parsed : undefined
  } catch {
    return undefined
  }
}

function writeState(state: TourState | undefined) {
  if (typeof window === 'undefined') return
  if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  else window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

export function StartTourButton({ tour }: { tour: TourDefinition }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        writeState({ key: tour.key, step: 0 })
        const first = tour.steps[0]
        if (first) router.push(first.href)
      }}
      className="inline-flex items-center rounded-md border border-accent-600 bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
    >
      Start this tour
    </button>
  )
}

export function TourOverlay({ tours }: { tours: TourDefinition[] }) {
  const router = useRouter()
  const [state, setState] = useState<TourState | undefined>(undefined)

  useEffect(() => {
    const sync = () => setState(readState())
    sync()
    window.addEventListener(CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const goTo = useCallback(
    (tour: TourDefinition, step: number) => {
      const target = tour.steps[step]
      if (!target) return
      writeState({ key: tour.key, step })
      setState({ key: tour.key, step })
      router.push(target.href)
    },
    [router],
  )

  if (!state) return null
  const tour = tours.find((entry) => entry.key === state.key)
  const step = tour?.steps[state.step]
  if (!tour || !step) return null

  const isLast = state.step === tour.steps.length - 1

  return (
    <aside
      aria-label={`Guided tour: ${tour.title}`}
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-accent-500 bg-white shadow-lg"
    >
      <div className="flex items-start justify-between gap-2 border-b border-ink-200 px-4 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Guided tour</p>
          <p className="text-sm font-semibold text-ink-900">{tour.title}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            writeState(undefined)
            setState(undefined)
          }}
          aria-label="End the tour"
          className="rounded-md border border-ink-300 px-2 py-0.5 text-xs text-ink-600 hover:bg-ink-50"
        >
          End
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-ink-500">
          Step {state.step + 1} of {tour.steps.length} · {tour.audience}
        </p>
        <p className="mt-1 text-sm font-medium text-ink-900">{step.title}</p>
        <p className="mt-1 text-sm text-ink-700">{step.instruction}</p>
        <p className="mt-2 text-xs text-ink-500">
          You are on the real screen this step describes — try it, then continue.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-4 py-2">
        <button
          type="button"
          disabled={state.step === 0}
          onClick={() => goTo(tour, state.step - 1)}
          className="rounded-md border border-ink-300 px-2.5 py-1 text-sm text-ink-700 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(step.href)}
            className="rounded-md border border-ink-300 px-2.5 py-1 text-sm text-ink-700"
          >
            Show me
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                writeState(undefined)
                setState(undefined)
              }}
              className="rounded-md border border-accent-600 bg-accent-600 px-2.5 py-1 text-sm font-medium text-white"
            >
              Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(tour, state.step + 1)}
              className="rounded-md border border-accent-600 bg-accent-600 px-2.5 py-1 text-sm font-medium text-white"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
