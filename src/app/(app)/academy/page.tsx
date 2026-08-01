import Link from 'next/link'
import {
  GUIDED_TOURS,
  PRIMER_SECTIONS,
  STAGE_GUIDES,
  allGlossaryTerms,
  raciRows,
  roleGuides,
} from '@/lib/guides/registry'
import { STAGES } from '@/lib/lifecycle/stages'
import { StartTourButton } from '@/components/tour'
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader } from '@/components/ui'

export default function AcademyPage() {
  const glossary = allGlossaryTerms()
  const raci = raciRows()
  const roles = roleGuides()

  return (
    <div>
      <PageHeader
        eyebrow="Enable"
        title="Academy"
        description="How data products work here. Every technical term is defined at first use; nothing assumes you already know what a semantic layer is."
        actions={<LinkButton href="/api/export/primer">Printable primer (PDF)</LinkButton>}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          How data products work here
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {PRIMER_SECTIONS.map((section) => (
            <Card key={section.title}>
              <CardBody>
                <h3 className="text-sm font-semibold text-ink-900">{section.title}</h3>
                <p className="mt-1 text-sm text-ink-700">{section.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Guided tours
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GUIDED_TOURS.map((tour) => (
            <Card key={tour.key} as="article">
              <CardHeader
                title={tour.title}
                description={`${tour.audience} · ${tour.minutes} minutes`}
              />
              <CardBody>
                <ol className="space-y-2 text-sm">
                  {tour.steps.slice(0, 4).map((step, index) => (
                    <li key={step.title}>
                      <span className="mr-1 text-ink-400">{index + 1}.</span>
                      <Link href={step.href} className="text-accent-600 hover:underline">
                        {step.title}
                      </Link>
                      <p className="text-xs text-ink-600">{step.instruction}</p>
                    </li>
                  ))}
                  {tour.steps.length > 4 ? (
                    <li className="text-xs text-ink-500">…and {tour.steps.length - 4} more steps.</li>
                  ) : null}
                </ol>
                <div className="mt-3">
                  <StartTourButton tour={tour} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          The twelve stages
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {STAGE_GUIDES.map((guide) => (
            <Card key={guide.key}>
              <CardBody>
                <h3 className="text-sm font-semibold text-ink-900">
                  <Link href={`/academy/${guide.key}`} className="hover:underline">
                    Stage {guide.stageNumber} · {guide.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-ink-700">{guide.why}</p>
                <p className="mt-2 text-xs text-ink-500">Typical effort: {guide.effort}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          RACI, generated from the stage registry
        </h2>
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-xs">
              <caption className="px-5 py-2 text-left text-xs text-ink-600">
                Computed from the same registry the transition engine enforces, so it cannot drift
                from actual behaviour.
              </caption>
              <thead className="bg-ink-50 text-left uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2">Role</th>
                  {STAGES.map((stage) => (
                    <th key={stage.number} className="px-1 py-2 text-center" title={stage.name}>
                      {stage.number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {raci.map((row) => (
                  <tr key={row.role} className="border-t border-ink-100">
                    <td className="px-4 py-1.5 font-medium text-ink-800">{row.name}</td>
                    {row.stages.map((cell) => (
                      <td key={cell.number} className="px-1 py-1.5 text-center">
                        {cell.responsibility === 'VETO' ? (
                          <span className="font-bold text-rose-700" title="Holds a veto">
                            V
                          </span>
                        ) : cell.responsibility === 'APPROVES' ? (
                          <span className="text-emerald-700" title="Approves">
                            A
                          </span>
                        ) : (
                          <span className="text-ink-300">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Role guides</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.role} as="article">
              <CardHeader title={role.name} description={role.youOwn} actions={<Badge>{role.door}</Badge>} />
              <CardBody>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
                  {role.yourDayLooksLike.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-600">{role.whereYouVeto}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Glossary</h2>
        <Card>
          <CardBody>
            <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {glossary.map((entry) => (
                <div key={entry.term}>
                  <dt className="text-sm font-medium text-ink-900">{entry.term}</dt>
                  <dd className="text-sm text-ink-600">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
