'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { submitRequest, type IntakeResult } from '../actions'
import { readIntakeForm, validateIntake } from '@/lib/requests/intake'
import { Badge, Button, Card, CardBody, CardHeader, ErrorText, Field, inputClass } from '@/components/ui'

const STEPS = [
  { title: 'The decision', hint: 'What can you not decide today?' },
  { title: 'You and your team', hint: 'Who is blocked, and how often?' },
  { title: 'The questions', hint: 'What would you ask if you had the data?' },
  { title: 'The stakes', hint: 'What happens if this decision is wrong or late?' },
  { title: 'Constraints', hint: 'Freshness, how you would use it, and sensitivity.' },
]

const EMPTY_ANSWERS = {
  title: '',
  decision: '',
  consumerRole: '',
  peopleAffected: '1',
  cadence: '',
  currentWorkaround: '',
  timeTakenToday: '',
  stakes: '',
  quantifiedImpact: '',
  requiredFreshness: '',
  preferredPatternKey: '',
  sensitivityNotes: '',
}

type Answers = typeof EMPTY_ANSWERS

export function IntakeWizard({ patterns }: { patterns: { key: string; name: string }[] }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  const [questions, setQuestions] = useState(['', '', ''])
  const [focusField, setFocusField] = useState<string | undefined>(undefined)
  const submittedRef = useRef<string | undefined>(undefined)

  /**
   * Every answer is controlled. React resets an uncontrolled form once its action resolves, which
   * would silently wipe the wizard the moment the duplicate check came back — leaving "Submit
   * anyway" submitting an empty form. The validation guard runs the same schema as the server so a
   * missing answer opens the step that owns it rather than failing where nobody can see it.
   */
  const [state, formAction, pending] = useActionState<IntakeResult | undefined, FormData>(
    async (previous, formData) => {
      const parsed = validateIntake(readIntakeForm(formData))
      if (!parsed.ok) {
        return {
          matches: previous?.matches,
          checked: previous?.checked,
          error: parsed.error.message,
          errorStep: parsed.error.step ?? undefined,
          errorField: parsed.error.field || undefined,
        }
      }
      return submitRequest(previous, formData)
    },
    undefined,
  )

  const showMatches = (state?.matches?.length ?? 0) > 0
  const set = (field: keyof Answers) => (value: string) =>
    setAnswers((current) => ({ ...current, [field]: value }))

  /**
   * The payload is built from wizard state, not scraped off the DOM, so it cannot be emptied by the
   * form reset React performs once an action resolves. Without this, the second press — "Submit
   * anyway" — posted a blank request.
   */
  function buildPayload(): FormData {
    const payload = new FormData()
    for (const [field, value] of Object.entries(answers)) payload.set(field, value)
    for (const question of questions) payload.append('questions', question)
    if (showMatches) payload.set('confirmed', 'true')
    return payload
  }

  // A rejected answer opens its step, so the message is never about a field nobody can see.
  const errorField = state?.error ? state.errorField : undefined
  const errorStep = state?.error ? state.errorStep : undefined
  useEffect(() => {
    if (errorStep === undefined) return
    setStep(errorStep)
    setFocusField(errorField === 'questions' ? 'question-0' : errorField)
  }, [errorStep, errorField, state])

  // Focus lands in a second pass: the step it belongs to has to be on screen before it can take it.
  useEffect(() => {
    if (!focusField) return
    document.getElementById(focusField)?.focus()
    setFocusField(undefined)
  }, [focusField, step])

  // Clear the wizard once a request is filed, so the next one does not start pre-filled.
  useEffect(() => {
    if (!state?.requestId || submittedRef.current === state.requestId) return
    submittedRef.current = state.requestId
    setAnswers(EMPTY_ANSWERS)
    setQuestions(['', '', ''])
    setStep(0)
  }, [state?.requestId])

  return (
    // Native validation is off: required answers live on steps that are hidden, and a browser
    // cannot focus a hidden control, so it would block submission with no message at all.
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        formAction(buildPayload())
      }}
    >
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
                  : errorStep === index
                    ? 'border-rose-400 bg-rose-50 text-rose-800 hover:bg-rose-100'
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
              <input
                id="title"
                name="title"
                className={inputClass}
                aria-required="true"
                value={answers.title}
                onChange={(event) => set('title')(event.target.value)}
              />
            </Field>
            <Field
              label="What decision are you trying to make that you can't make today?"
              htmlFor="decision"
              hint="Write it as a decision, not as a report request. “Which customers to contact this week” rather than “a customer dashboard”."
              required
            >
              <textarea
                id="decision"
                name="decision"
                rows={4}
                className={inputClass}
                aria-required="true"
                value={answers.decision}
                onChange={(event) => set('decision')(event.target.value)}
              />
            </Field>
          </div>

          <div hidden={step !== 1}>
            <Field
              label="Who is blocked?"
              htmlFor="consumerRole"
              hint="A named role — “Collections Manager”, not “the business”."
              required
            >
              <input
                id="consumerRole"
                name="consumerRole"
                className={inputClass}
                aria-required="true"
                value={answers.consumerRole}
                onChange={(event) => set('consumerRole')(event.target.value)}
              />
            </Field>
            <Field label="How many people are affected?" htmlFor="peopleAffected" required>
              <input
                id="peopleAffected"
                name="peopleAffected"
                type="number"
                min={1}
                className={inputClass}
                aria-required="true"
                value={answers.peopleAffected}
                onChange={(event) => set('peopleAffected')(event.target.value)}
              />
            </Field>
            <Field label="How often does this decision recur?" htmlFor="cadence" required>
              <input
                id="cadence"
                name="cadence"
                placeholder="Daily, weekly, each quarter…"
                className={inputClass}
                aria-required="true"
                value={answers.cadence}
                onChange={(event) => set('cadence')(event.target.value)}
              />
            </Field>
            <Field label="What do you do today instead?" htmlFor="currentWorkaround" required>
              <textarea
                id="currentWorkaround"
                name="currentWorkaround"
                rows={3}
                className={inputClass}
                aria-required="true"
                value={answers.currentWorkaround}
                onChange={(event) => set('currentWorkaround')(event.target.value)}
              />
            </Field>
            <Field label="How long does that take?" htmlFor="timeTakenToday" required>
              <input
                id="timeTakenToday"
                name="timeTakenToday"
                placeholder="About 4 hours a week"
                className={inputClass}
                aria-required="true"
                value={answers.timeTakenToday}
                onChange={(event) => set('timeTakenToday')(event.target.value)}
              />
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
                  aria-required={index < 3 ? 'true' : undefined}
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
              <textarea
                id="stakes"
                name="stakes"
                rows={4}
                className={inputClass}
                aria-required="true"
                value={answers.stakes}
                onChange={(event) => set('stakes')(event.target.value)}
              />
            </Field>
            <Field
              label="Quantify it if you can"
              htmlFor="quantifiedImpact"
              hint="Cost, risk, revenue, compliance exposure, customer impact. An estimate is more useful than nothing."
            >
              <textarea
                id="quantifiedImpact"
                name="quantifiedImpact"
                rows={3}
                className={inputClass}
                value={answers.quantifiedImpact}
                onChange={(event) => set('quantifiedImpact')(event.target.value)}
              />
            </Field>
          </div>

          <div hidden={step !== 4}>
            <Field label="How fresh does the data need to be?" htmlFor="requiredFreshness" required>
              <input
                id="requiredFreshness"
                name="requiredFreshness"
                placeholder="Daily by 07:00"
                className={inputClass}
                aria-required="true"
                value={answers.requiredFreshness}
                onChange={(event) => set('requiredFreshness')(event.target.value)}
              />
            </Field>
            <Field label="How would you prefer to use it?" htmlFor="preferredPatternKey">
              <select
                id="preferredPatternKey"
                name="preferredPatternKey"
                className={inputClass}
                value={answers.preferredPatternKey}
                onChange={(event) => set('preferredPatternKey')(event.target.value)}
              >
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
              <textarea
                id="sensitivityNotes"
                name="sensitivityNotes"
                rows={3}
                className={inputClass}
                value={answers.sensitivityNotes}
                onChange={(event) => set('sensitivityNotes')(event.target.value)}
              />
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
            </div>
          ) : null}

          {state?.error ? (
            <ErrorText>
              {state.error}
              {errorStep !== undefined ? ` (step ${errorStep + 1}, ${STEPS[errorStep]!.title})` : ''}
            </ErrorText>
          ) : null}
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
