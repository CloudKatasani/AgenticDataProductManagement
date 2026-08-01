import Link from 'next/link'
import { listMarketplace } from '@/lib/queries/marketplace'
import { ARCHETYPE_LABELS, TIER_LABELS, type Archetype, type Tier } from '@/lib/domain/enums'
import { patternName, PATTERN_KEYS } from '@/lib/patterns/registry'
import { Badge, Card, CardBody, EmptyState, LinkButton, PageHeader, inputClass } from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Filters {
  q?: string
  industry?: string
  domain?: string
  archetype?: string
  tier?: string
  pattern?: string
  minQuality?: string
  access?: string
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Filters>
}) {
  const filters = await searchParams
  const all = await listMarketplace()

  const industries = [...new Set(all.map((e) => e.industry))].sort()
  const domains = [...new Set(all.map((e) => e.domainName))].sort()

  const q = (filters.q ?? '').trim().toLowerCase()
  const results = all.filter((entry) => {
    if (
      q &&
      ![entry.name, entry.listing.description, entry.listing.sampleQuestions.join(' '), entry.entities.join(' '), entry.metrics.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    ) {
      return false
    }
    if (filters.industry && entry.industry !== filters.industry) return false
    if (filters.domain && entry.domainName !== filters.domain) return false
    if (filters.archetype && entry.archetype !== filters.archetype) return false
    if (filters.tier && entry.tier !== filters.tier) return false
    if (filters.pattern && !entry.listing.supportedPatterns.includes(filters.pattern)) return false
    if (filters.access && entry.listing.accessTier !== filters.access) return false
    if (filters.minQuality && entry.listing.qualityScore < Number(filters.minQuality)) return false
    return true
  })

  return (
    <div>
      <PageHeader
        eyebrow="Consume"
        title="Marketplace"
        description="Every listing here is assembled from committed, approved artifacts. If a product does not answer your question, ask for one."
        actions={<LinkButton href="/request/new" variant="primary">Request a data product</LinkButton>}
      />

      <Card className="mb-6">
        <CardBody>
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-700">
                Search questions, entities and metrics
              </label>
              <input id="q" name="q" defaultValue={filters.q} className={inputClass} placeholder="e.g. arrears, churn, availability" />
            </div>
            <div>
              <label htmlFor="industry" className="mb-1 block text-xs font-medium text-ink-700">Industry</label>
              <select id="industry" name="industry" defaultValue={filters.industry ?? ''} className={inputClass}>
                <option value="">All</option>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="domain" className="mb-1 block text-xs font-medium text-ink-700">Domain</label>
              <select id="domain" name="domain" defaultValue={filters.domain ?? ''} className={inputClass}>
                <option value="">All</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="archetype" className="mb-1 block text-xs font-medium text-ink-700">Archetype</label>
              <select id="archetype" name="archetype" defaultValue={filters.archetype ?? ''} className={inputClass}>
                <option value="">All</option>
                {Object.entries(ARCHETYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tier" className="mb-1 block text-xs font-medium text-ink-700">Tier</label>
              <select id="tier" name="tier" defaultValue={filters.tier ?? ''} className={inputClass}>
                <option value="">All</option>
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pattern" className="mb-1 block text-xs font-medium text-ink-700">Consumption pattern</label>
              <select id="pattern" name="pattern" defaultValue={filters.pattern ?? ''} className={inputClass}>
                <option value="">All</option>
                {PATTERN_KEYS.map((key) => (
                  <option key={key} value={key}>{patternName(key)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="minQuality" className="mb-1 block text-xs font-medium text-ink-700">Minimum quality score</label>
              <input id="minQuality" name="minQuality" type="number" min={0} max={100} defaultValue={filters.minQuality} className={inputClass} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-md border border-accent-600 bg-accent-600 px-3 py-2 text-sm font-medium text-white">
                Apply
              </button>
              <Link href="/marketplace" className="rounded-md border border-ink-300 px-3 py-2 text-sm">
                Clear
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>

      <p className="mb-3 text-sm text-ink-600">
        {results.length} of {all.length} published products across {industries.length} industries.
      </p>

      {results.length === 0 ? (
        <EmptyState title="Nothing here answers that question yet.">
          <p>
            That is a useful signal, not a dead end.{' '}
            <Link href="/request/new" className="font-medium text-accent-600 underline">
              Describe the decision you cannot make today
            </Link>{' '}
            and a product owner will triage it.
          </p>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((entry) => (
            <li key={entry.productId}>
              <Card as="article" className="flex h-full flex-col">
                <CardBody className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ink-900">
                      <Link href={`/marketplace/${entry.key}`} className="hover:underline">
                        {entry.name}
                      </Link>
                    </h2>
                    <Badge tone={entry.listing.qualityScore >= 90 ? 'good' : 'warn'}>
                      Quality {entry.listing.qualityScore}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {entry.industry} · {entry.domainName}
                  </p>
                  <p className="mt-2 flex-1 text-sm text-ink-700">{entry.listing.headline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge>{ARCHETYPE_LABELS[entry.archetype as Archetype] ?? entry.archetype}</Badge>
                    <Badge>{TIER_LABELS[entry.tier as Tier] ?? entry.tier}</Badge>
                    <Badge tone="info">{entry.listing.freshness}</Badge>
                    <Badge tone={entry.listing.accessTier === 'RESTRICTED' ? 'bad' : 'neutral'}>
                      {entry.listing.accessTier}
                    </Badge>
                  </div>
                  {entry.listing.sampleQuestions[0] ? (
                    <p className="mt-3 border-l-2 border-ink-200 pl-3 text-xs italic text-ink-600">
                      “{entry.listing.sampleQuestions[0]}”
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
