import { z } from 'zod'
import { severitySchema } from '@/lib/domain/enums'
import type { AgentDefinition } from './registry'
import { heuristicOutput } from './heuristics'

/**
 * The provider adapter. Model and vendor are swappable; nothing above this file knows which
 * provider ran. Two are shipped:
 *
 *   `local-heuristic` — deterministic, rule-based, no network call. The default, so the whole
 *                       lifecycle is demonstrable offline. Labelled as such everywhere it appears.
 *   `anthropic`       — calls the configured Claude model with a user-supplied API key.
 */

export const proposalDraftSchema = z.object({
  fieldPath: z.string().min(1),
  value: z.unknown(),
  rationale: z.string().default(''),
})

export const findingDraftSchema = z.object({
  title: z.string().min(1),
  detail: z.string().default(''),
  severity: severitySchema.default('MEDIUM'),
})

export const commentDraftSchema = z.object({
  fieldPath: z.string().default(''),
  body: z.string().min(1),
})

export const agentOutputSchema = z.object({
  narrative: z.string().default(''),
  proposals: z.array(proposalDraftSchema).default([]),
  findings: z.array(findingDraftSchema).default([]),
  comments: z.array(commentDraftSchema).default([]),
})

export type AgentOutput = z.infer<typeof agentOutputSchema>
export type ProposalDraft = z.infer<typeof proposalDraftSchema>
export type FindingDraft = z.infer<typeof findingDraftSchema>
export type CommentDraft = z.infer<typeof commentDraftSchema>

export interface AgentInvocationContext {
  agent: AgentDefinition
  stageNumber: number
  productName: string
  /** Redacted, scope-limited artifact content. Nothing outside the agent's read scope. */
  scopedArtifacts: Record<string, unknown>
  /** Extra facts the runtime supplies, e.g. workspace metric names for collision detection. */
  facts: Record<string, unknown>
}

export interface ProviderResult {
  model: string
  output: AgentOutput
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
  durationMs: number
}

export interface AgentProvider {
  id: string
  label: string
  run(context: AgentInvocationContext): Promise<ProviderResult>
}

export const LOCAL_PROVIDER_ID = 'local-heuristic'

export const localHeuristicProvider: AgentProvider = {
  id: LOCAL_PROVIDER_ID,
  label: 'Local heuristic (no model call, no data leaves this machine)',
  async run(context) {
    const started = Date.now()
    const output = heuristicOutput(context)
    return {
      model: LOCAL_PROVIDER_ID,
      output,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      durationMs: Date.now() - started,
    }
  },
}

/** Per-million-token pricing used only for the cost telemetry in the Agents tab. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export const DEFAULT_MODEL = 'claude-opus-5'

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICING[model] ?? PRICING[DEFAULT_MODEL]
  if (!price) return 0
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output
}

export function createAnthropicProvider(apiKey: string, model = DEFAULT_MODEL): AgentProvider {
  return {
    id: 'anthropic',
    label: `Anthropic ${model}`,
    async run(context) {
      const started = Date.now()
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey })

      const system = `${context.agent.promptTemplate}

You are operating inside Agentic Data Product Management. You produce proposals only. You never
approve a gate, commit a version, publish a product or satisfy an exit criterion — a human
dispositions everything you return.

Reply with a single JSON object and nothing else:
{"narrative": string,
 "proposals": [{"fieldPath": string, "value": any, "rationale": string}],
 "findings":  [{"title": string, "detail": string, "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"}],
 "comments":  [{"fieldPath": string, "body": string}]}
"fieldPath" addresses the artifact content, e.g. "decisions[0].questions".`

      const message = await client.messages.create({
        model,
        max_tokens: 16000,
        system,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(
              {
                product: context.productName,
                stage: context.stageNumber,
                readScope: context.agent.readScope,
                artifacts: context.scopedArtifacts,
                facts: context.facts,
              },
              null,
              2,
            ),
          },
        ],
      })

      const text = message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim()

      const promptTokens = message.usage.input_tokens
      const completionTokens = message.usage.output_tokens

      return {
        model,
        output: parseAgentOutput(text),
        promptTokens,
        completionTokens,
        estimatedCostUsd: estimateCost(model, promptTokens, completionTokens),
        durationMs: Date.now() - started,
      }
    },
  }
}

/** Tolerant parse: a malformed reply becomes a finding, never a silent success. */
export function parseAgentOutput(text: string): AgentOutput {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) {
    return {
      narrative: text.slice(0, 2000),
      proposals: [],
      findings: [
        {
          title: 'Agent returned no structured output',
          detail: 'The reply could not be parsed as JSON, so nothing was proposed.',
          severity: 'LOW',
        },
      ],
      comments: [],
    }
  }
  try {
    const parsed = agentOutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)))
    if (parsed.success) return parsed.data
    return {
      narrative: text.slice(0, 2000),
      proposals: [],
      findings: [
        {
          title: 'Agent output failed validation',
          detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          severity: 'LOW',
        },
      ],
      comments: [],
    }
  } catch (error) {
    return {
      narrative: text.slice(0, 2000),
      proposals: [],
      findings: [
        {
          title: 'Agent output was not valid JSON',
          detail: error instanceof Error ? error.message : 'Unknown parse error.',
          severity: 'LOW',
        },
      ],
      comments: [],
    }
  }
}
