'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { submitRequest, type IntakeResult } from '../actions'
import { Badge, Button, Card, CardBody, CardHeader, ErrorText, Field, inputClass } from '@/components/ui'

const STEPS = [
  { title: 'The decision', hint: 'What can you not decide today?' },
  { title: 'You and your team', hint: 'Who is blocked, and how often?' },
  { title: 'The questions', hint: 'What would you ask if you had the data?' },
  { title: 'The stakes', hint: 'What happens if this decision is wrong or late?' },
  { title: 'Constraints', hint: 'Freshness, how you would use it, and sensitivity.' },
]

export function IntakeWizard({ patterns }: { patterns: { key: string; name: string }[] }) {
  const [step, setStep] = useState(0)
  const [questions, setQuestions] = useState(['', '', ''])
  const [state, formAction, pending] = useActionState<IntakeResult | undefined, FormData>(
    submitRequest,
    undefined,
  )

  const showMatches = (state?.matches?.length ?? 0) > 0

  return (
    <form action={formAction}>
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Intake steps">
        {STEPS.map((entry, index) => (
          <li key={entry.title}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                index === step
                  ? 'border-accent-600 bg-accent-600 text-white'
                  : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
              }`}
            >
              {index + 1}. {entry.title}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader title={STEPS[step]!.title} description={STEPS[step]!.hint} />
        <CardBody>
          <div hidden={step !== 0}>
            <Field label="Give this request a short title" htmlFor="title" required>
              <input id="title" name="title" className={inputClass} required />
            </Field>
            <Field
              label="What decision are you trying to make that you can't make today?"
              htmlFor="decision"
              hint="Write it as a decision, not as a report request. “Which customers to contact this week” rather than “a customer dashboard”."
              required
            >
              <textarea id="decision" name="decision" rows={4} className={inputClass} required />
            </Field>
          </div>

          <div hidden={step !== 1}>
            <Field
              label="Who is blocked?"
              htmlFor="consumerRole"
              hint="A named role — “Collections Manager”, not “the business”."
              required
            >
              <input id="consumerRole" name="consumerRole" className={inputClass} required />
            </Field>
            <Field label="How many people are affected?" htmlFor="peopleAffected" required>
              <input id="peopleAffected" name="peopleAffected" type="number" min={1} defaultValue={1} className={inputClass} required />
            </Field>
            <Field label="How often does this decision recur?" htmlFor="cadence" required>
              <input id="cadence" name="cadence" placeholder="Daily, weekly, each quarter…" className={inputClass} required />
            </Field>
            <Field label="What do you do today instead?" htmlFor="currentWorkaround" required>
              <textarea id="currentWorkaround" name="currentWorkaround" rows={3} className={inputClass} required />
            </Field>
            <Field label="How long does that take?" htmlFor="timeTakenToday" required>
              <input id="timeTakenToday" name="timeTakenToday" placeholder="About 4 hours a week" className={inputClass} required />
            </Field>
          </div>

          <div hidden={step !== 2}>
            <p className="mb-3 text-sm text-ink-600">
              These become the Stage 1 seed content and, later, the trace target for every certified
              metric. A metric that answers none of these questions will fail its exit criteria.
            </p>
            {questions.map((question, index) => (
              <Field key={index} label={`Question ${index + 1}`} htmlFor={`question-${index}`} required={index < 3}>
                <input
                  id={`question-${index}`}
                  name="questions"
                  className={inputClass}
                  value={question}
                  required={index < 3}
                  onChange={(event) => {
                    const next = [...questions]
                    next[index] = event.target.value
                    setQuestions(next)
                  }}
                />
              </Field>
            ))}
            <Button type="button" variant="secondary" onClick={() => setQuestions([...questions, ''])}>
              Add another question
            </Button>
          </div>

          <div hidden={step !== 3}>
            <Field
              label="What happens if the decision is not made, or made badly?"
              htmlFor="stakes"
              required
            >
              <textarea id="stakes" name="stakes" rows={4} className={inputClass} required />
            </Field>
            <Field
              label="Quantify it if you can"
              htmlFor="quantifiedImpact"
              hint="Cost, risk, revenue, compliance exposure, customer impact. An estimate is more useful than nothing."
            >
              <textarea id="quantifiedImpact" name="quantifiedImpact" rows={3} className={inputClass} />
            </Field>
          </div>

          <div hidden={step !== 4}>
            <Field label="How fresh does the data need to be?" htmlFor="requiredFreshness" required>
              <input id="requiredFreshness" name="requiredFreshness" placeholder="Daily by 07:00" className={inputClass} required />
            </Field>
            <Field label="How would you prefer to use it?" htmlFor="preferredPatternKey">
              <select id="preferredPatternKey" name="preferredPatternKey" className={inputClass} defaultValue="">
                <option value="">No preference</option>
                {patterns.map((pattern) => (
                  <option key={pattern.key} value={pattern.key}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Any known sensitivity or regulatory concern?"
              htmlFor="sensitivityNotes"
              hint="Say so now — it shapes Stage 9 and can change whether this is possible at all."
            >
              <textarea id="sensitivityNotes" name="sensitivityNotes" rows={3} className={inputClass} />
            </Field>
          </div>

          {showMatches ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {state?.matches?.length} existing product(s) may already answer this
              </p>
              <ul className="mt-2 space-y-2">
                {state?.matches?.map((match) => (
                  <li key={match.id} className="text-sm">
                    <Link href={match.href} className="font-medium text-accent-700 underline">
                      {match.name}
                    </Link>{' '}
                    <Badge tone="neutral">{Math.round(match.score * 100)}% overlap</Badge>
                    <span className="ml-2 text-xs text-ink-600">{match.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900">
                If one of these works, request access instead — reuse is cheaper than building. If
                not, submit anyway and say why in triage.
              </p>
              <input type="hidden" name="confirmed" value="true" />
            </div>
          ) : null}

          {state?.error ? <ErrorText>{state.error}</ErrorText> : null}
          {state?.ok ? (
            <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {state.ok}{' '}
              {state.requestId ? (
                <Link href={`/request/${state.requestId}`} className="underline">
                  Follow its status
                </Link>
              ) : null}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-200 pt-4">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={step === STEPS.length - 1}
                onClick={() => setStep(step + 1)}
              >
                Next
              </Button>
            </div>
            <Button disabled={pending}>
              {pending ? 'Checking…' : showMatches ? 'Submit anyway' : 'Check for duplicates and submit'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  )
}
