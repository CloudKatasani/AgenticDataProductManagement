import { z } from 'zod'

/**
 * One schema, shared by the intake wizard and the `submitRequest` server action. The wizard runs it
 * before submitting so a missing answer names the screen that owns it, instead of the browser
 * silently refusing to submit a required field that lives on a step the requester cannot see.
 * The server runs it again — the client check is a convenience, never a control.
 */
export const intakeSchema = z.object({
  title: z.string().trim().min(5, 'Give the request a short title.'),
  decision: z.string().trim().min(15, 'Describe the decision you cannot make today.'),
  consumerRole: z
    .string()
    .trim()
    .min(3, 'Name a specific role.')
    .refine((v) => !/^the business$/i.test(v), 'Name a specific role, not "the business".'),
  peopleAffected: z.coerce.number().min(1, 'At least one person has to be affected.'),
  cadence: z.string().trim().min(2, 'How often does this decision recur?'),
  currentWorkaround: z.string().trim().min(5, 'What do you do today instead?'),
  timeTakenToday: z.string().trim().min(2, 'Roughly how long does it take today?'),
  questions: z
    .array(z.string().trim().min(5, 'Write each question as a full question.'))
    .min(3, 'Give at least three questions.'),
  stakes: z.string().trim().min(15, 'What happens if the decision is not made, or made badly?'),
  quantifiedImpact: z.string().trim().default(''),
  requiredFreshness: z.string().trim().min(2, 'How fresh does the data need to be?'),
  preferredPatternKey: z.string().trim().default(''),
  sensitivityNotes: z.string().trim().default(''),
})

export type IntakeInput = z.infer<typeof intakeSchema>

/** Which wizard step owns each answer, so a failure can send the requester straight to it. */
export const INTAKE_FIELD_STEP: Record<string, number> = {
  title: 0,
  decision: 0,
  consumerRole: 1,
  peopleAffected: 1,
  cadence: 1,
  currentWorkaround: 1,
  timeTakenToday: 1,
  questions: 2,
  stakes: 3,
  quantifiedImpact: 3,
  requiredFreshness: 4,
  preferredPatternKey: 4,
  sensitivityNotes: 4,
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '')
}

/** Read the intake answers out of a form payload. Shared so client and server see the same input. */
export function readIntakeForm(formData: FormData): Record<string, unknown> {
  return {
    title: text(formData, 'title'),
    decision: text(formData, 'decision'),
    consumerRole: text(formData, 'consumerRole'),
    peopleAffected: text(formData, 'peopleAffected'),
    cadence: text(formData, 'cadence'),
    currentWorkaround: text(formData, 'currentWorkaround'),
    timeTakenToday: text(formData, 'timeTakenToday'),
    questions: formData
      .getAll('questions')
      .map((question) => String(question).trim())
      .filter(Boolean),
    stakes: text(formData, 'stakes'),
    quantifiedImpact: text(formData, 'quantifiedImpact'),
    requiredFreshness: text(formData, 'requiredFreshness'),
    preferredPatternKey: text(formData, 'preferredPatternKey'),
    sensitivityNotes: text(formData, 'sensitivityNotes'),
  }
}

export interface IntakeFieldError {
  /** The first failing field, or '' when the failure is not attributable to one. */
  field: string
  /** The wizard step that owns the failing field, or null when unknown. */
  step: number | null
  message: string
}

/** Validate intake answers and report the first failure against the step that owns it. */
export function validateIntake(
  input: Record<string, unknown>,
): { ok: true; data: IntakeInput } | { ok: false; error: IntakeFieldError } {
  const parsed = intakeSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  const issue = parsed.error.issues[0]
  const field = String(issue?.path[0] ?? '')
  return {
    ok: false,
    error: {
      field,
      step: INTAKE_FIELD_STEP[field] ?? null,
      message: issue?.message ?? 'Please complete the required answers.',
    },
  }
}
