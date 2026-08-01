/**
 * Prioritisation scoring. Advisory only — every score can be overridden by a named human with a
 * recorded reason, because a scoring model no human can override is a governance failure.
 */

export interface ScoreInputs {
  /** 1–10: how much the blocked decision is worth unblocking. */
  value: number
  /** 1–10: how much worse it gets by waiting. */
  urgency: number
  /** 1–10: risk or compliance exposure removed. */
  riskReduction: number
  /** 1–10: relative effort. Higher is more effort. */
  effort: number
  /** 0–1: share of the conformed backbone and existing attribute base reused. */
  reuse: number
}

export interface ScoreResult {
  model: 'WSJF_REUSE' | 'RICE'
  score: number
  explanation: string
}

/** WSJF adapted with a reuse multiplier: (value × urgency × risk) / effort × (1 + reuse). */
export function wsjfWithReuse(inputs: ScoreInputs): ScoreResult {
  const effort = Math.max(inputs.effort, 1)
  const base = (inputs.value + inputs.urgency + inputs.riskReduction) / effort
  const score = Number((base * (1 + inputs.reuse)).toFixed(2))
  return {
    model: 'WSJF_REUSE',
    score,
    explanation: `((${inputs.value} value + ${inputs.urgency} urgency + ${inputs.riskReduction} risk) ÷ ${effort} effort) × ${(1 + inputs.reuse).toFixed(2)} reuse multiplier`,
  }
}

/** RICE, offered as the alternative model. Reach is approximated by people affected. */
export function rice(inputs: { reach: number; impact: number; confidence: number; effort: number }): ScoreResult {
  const effort = Math.max(inputs.effort, 1)
  const score = Number(((inputs.reach * inputs.impact * inputs.confidence) / effort).toFixed(2))
  return {
    model: 'RICE',
    score,
    explanation: `(${inputs.reach} reach × ${inputs.impact} impact × ${inputs.confidence} confidence) ÷ ${effort} effort`,
  }
}

/**
 * Derives scoring inputs from what the product has actually committed, so the score is not a
 * separate opinion maintained by hand.
 */
export function deriveInputs(params: {
  peopleAffected: number
  cadence: string
  sensitiveAttributes: number
  buildEffortDays: number
  backboneBindings: number
  reusedMetrics: number
  totalMetrics: number
}): ScoreInputs {
  const cadenceWeight = /hour|daily|day/i.test(params.cadence)
    ? 9
    : /week/i.test(params.cadence)
      ? 7
      : /month/i.test(params.cadence)
        ? 5
        : 3
  return {
    value: Math.min(10, Math.max(1, Math.round(Math.log10(Math.max(params.peopleAffected, 1)) * 4 + 2))),
    urgency: cadenceWeight,
    riskReduction: Math.min(10, 2 + params.sensitiveAttributes),
    effort: Math.min(10, Math.max(1, Math.round(params.buildEffortDays / 10))),
    reuse:
      params.totalMetrics === 0
        ? Math.min(1, params.backboneBindings * 0.2)
        : Math.min(1, params.backboneBindings * 0.2 + params.reusedMetrics / params.totalMetrics),
  }
}
