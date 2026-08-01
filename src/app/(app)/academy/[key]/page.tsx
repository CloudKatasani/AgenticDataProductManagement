import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuide, STAGE_GUIDES } from '@/lib/guides/registry'
import { getStage } from '@/lib/lifecycle/stages'
import { roleName } from '@/lib/domain/roles'
import { artifactTitle } from '@/lib/artifacts/registry'
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export function generateStaticParams() {
  return STAGE_GUIDES.map((guide) => ({ key: guide.key }))
}

export default async function GuidePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const guide = getGuide(key)
  if (!guide) notFound()
  const stage = getStage(guide.stageNumber)

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <Link href="/academy" className="text-accent-600 underline">
          ← Academy
        </Link>
      </p>
      <PageHeader
        eyebrow={`Stage ${guide.stageNumber} of 12`}
        title={guide.title}
        description={stage.purpose}
        actions={<Badge tone="info">{guide.effort}</Badge>}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Why this stage exists" />
          <CardBody>
            <p className="text-sm text-ink-800">{guide.why}</p>
            <p className="mt-3 text-sm text-ink-800">
              <strong>In plain terms.</strong> {guide.plainTerms}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What breaks if you skip it" />
          <CardBody>
            <p className="text-sm text-ink-800">{guide.whatBreaks}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Who is involved" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {guide.whoIsInvolved.map((entry) => (
                <li key={entry.role}>
                  <span className="font-medium text-ink-900">{roleName(entry.role)}</span> —{' '}
                  <span className="text-ink-700">{entry.contributes}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-600">
              Gate: quorum {stage.quorum} of {stage.approverRoles.map(roleName).join(', ')}
              {stage.vetoRoles.length ? ` · veto held by ${stage.vetoRoles.map(roleName).join(', ')}` : ''}.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What good looks like" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
              {guide.whatGoodLooksLike.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="The mistakes teams actually make here" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
              {guide.commonMistakes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Artifacts produced" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
              {stage.requiredArtifacts.map((type) => (
                <li key={type}>{artifactTitle(type)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-600">
              Permitted agents: {stage.permittedAgents.join(', ') || 'none'}. Every one of them
              produces proposals a human dispositions.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Terms introduced here" />
          <CardBody>
            <dl className="space-y-2">
              {guide.glossary.map((entry) => (
                <div key={entry.term}>
                  <dt className="text-sm font-medium text-ink-900">{entry.term}</dt>
                  <dd className="text-sm text-ink-600">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
