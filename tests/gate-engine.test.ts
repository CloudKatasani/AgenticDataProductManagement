import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateGateOutcome } from '@/lib/lifecycle/transitions'
import { STAGES } from '@/lib/lifecycle/stages'

describe('quorum and veto arithmetic', () => {
  it('approves once quorum of distinct approver roles is reached', () => {
    const outcome = evaluateGateOutcome({
      approverRoles: ['DOMAIN_PRODUCT_OWNER', 'DOMAIN_SME'],
      vetoRoles: [],
      quorum: 2,
      approvals: [
        { roleKey: 'DOMAIN_PRODUCT_OWNER', decision: 'APPROVE' },
        { roleKey: 'DOMAIN_SME', decision: 'APPROVE' },
      ],
    })
    expect(outcome.state).toBe('APPROVED')
  })

  it('does not count the same role twice towards quorum', () => {
    const outcome = evaluateGateOutcome({
      approverRoles: ['DOMAIN_PRODUCT_OWNER', 'DOMAIN_SME'],
      vetoRoles: [],
      quorum: 2,
      approvals: [
        { roleKey: 'DOMAIN_PRODUCT_OWNER', decision: 'APPROVE' },
        { roleKey: 'DOMAIN_PRODUCT_OWNER', decision: 'APPROVE' },
      ],
    })
    expect(outcome.state).toBe('OPEN')
    expect(outcome.approvingRoles).toEqual(['DOMAIN_PRODUCT_OWNER'])
  })

  it('rejects outright when a veto role rejects, regardless of quorum', () => {
    const outcome = evaluateGateOutcome({
      approverRoles: ['PRIVACY_SECURITY_OFFICER', 'DOMAIN_PRODUCT_OWNER', 'DATA_STEWARD'],
      vetoRoles: ['PRIVACY_SECURITY_OFFICER'],
      quorum: 2,
      approvals: [
        { roleKey: 'DOMAIN_PRODUCT_OWNER', decision: 'APPROVE' },
        { roleKey: 'DATA_STEWARD', decision: 'APPROVE' },
        { roleKey: 'PRIVACY_SECURITY_OFFICER', decision: 'REJECT' },
      ],
    })
    expect(outcome.state).toBe('REJECTED')
    expect(outcome.reason).toContain('PRIVACY_SECURITY_OFFICER')
  })

  it('treats silence from a veto holder as not consent', () => {
    const outcome = evaluateGateOutcome({
      approverRoles: ['PRIVACY_SECURITY_OFFICER', 'DOMAIN_PRODUCT_OWNER', 'DATA_STEWARD'],
      vetoRoles: ['PRIVACY_SECURITY_OFFICER'],
      quorum: 2,
      approvals: [
        { roleKey: 'DOMAIN_PRODUCT_OWNER', decision: 'APPROVE' },
        { roleKey: 'DATA_STEWARD', decision: 'APPROVE' },
      ],
    })
    expect(outcome.state).toBe('OPEN')
    expect(outcome.reason).toContain('veto holder')
  })

  it('rejects when quorum can no longer be reached', () => {
    const outcome = evaluateGateOutcome({
      approverRoles: ['DATA_ARCHITECT', 'DATA_ENGINEER'],
      vetoRoles: [],
      quorum: 2,
      approvals: [{ roleKey: 'DATA_ENGINEER', decision: 'REJECT' }],
    })
    expect(outcome.state).toBe('REJECTED')
    expect(outcome.reason).toContain('no longer')
  })

  it('never approves from an empty ballot', () => {
    for (const stage of STAGES) {
      const outcome = evaluateGateOutcome({
        approverRoles: stage.approverRoles,
        vetoRoles: stage.vetoRoles,
        quorum: stage.quorum,
        approvals: [],
      })
      expect(outcome.state, `stage ${stage.number}`).toBe('OPEN')
    }
  })
})

describe('invariant 2: recordDecision is the only approval path', () => {
  function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        sourceFiles(full, acc)
      } else if (/\.(ts|tsx)$/.test(entry)) {
        acc.push(full)
      }
    }
    return acc
  }

  it('no file other than transitions.ts writes an APPROVED gate state', () => {
    const offenders: string[] = []
    const roots = [join(process.cwd(), 'src'), join(process.cwd(), 'prisma')]
    for (const root of roots) {
      for (const file of sourceFiles(root)) {
        if (file.endsWith(join('lifecycle', 'transitions.ts'))) continue
        const source = readFileSync(file, 'utf8')
        // Any gate.update / gate.upsert / gate.create carrying an APPROVED state literal.
        const pattern = /gate\.(update|updateMany|upsert|create)\s*\(([\s\S]{0,400}?)\)/g
        for (const match of source.matchAll(pattern)) {
          if (/state:\s*['"]APPROVED['"]/.test(match[2] ?? '')) offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the stage registry never grants an agent an approver or veto role', () => {
    for (const stage of STAGES) {
      for (const agentId of stage.permittedAgents) {
        expect(stage.approverRoles).not.toContain(agentId)
        expect(stage.vetoRoles).not.toContain(agentId)
      }
    }
  })
})
