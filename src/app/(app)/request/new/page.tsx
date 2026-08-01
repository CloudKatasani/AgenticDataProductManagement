import { CONSUMPTION_PATTERNS } from '@/lib/patterns/registry'
import { PageHeader } from '@/components/ui'
import { IntakeWizard } from './wizard'

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Consume"
        title="Request a data product"
        description="Five short screens, plain language, no jargon. We ask about the decision first because a product built without one is the most common way this goes wrong."
      />
      <IntakeWizard
        patterns={CONSUMPTION_PATTERNS.map((pattern) => ({ key: pattern.key, name: pattern.name }))}
      />
    </div>
  )
}
